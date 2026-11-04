import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA } from "../config/solvePivot.ts";
import { AdaptiveDpr } from "../core/AdaptiveDpr.ts";
import {
  reducedPose,
  sharedProgress,
  type Progress,
  type ReducedPose,
  type StepEnterDetail,
  type StepLeaveDetail,
} from "../core/Progress.ts";
import { sharedMapper, type StateMapper } from "../core/StateMapper.ts";
import { onTick } from "../core/Ticker.ts";
import { DEBUG_MODE } from "../debug/registry";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { setAssetProgress, setSceneReady } from "../lib/assetProgress";
import { Bottle } from "./Bottle";
import { Carousel } from "./Carousel";
import { LightRig } from "./Environment";
import { Lights } from "./Lights";

// Il progresso reale dei GLB per il Loader del sito, che sta nel bundle
// principale e non può importare drei. A livello di modulo: parte appena il
// chunk dell'esperienza arriva, prima che il canvas monti. Il preload di
// `Bottle.tsx` gira prima (import qui sopra) e il suo avvio sincrono non
// arriva alla sottoscrizione: lo recupera la lettura iniziale.
useProgress.subscribe((s) => {
  setAssetProgress({ progress: s.progress, active: s.active });
});
setAssetProgress({
  progress: useProgress.getState().progress,
  active: useProgress.getState().active,
});

const EnvProbe = lazy(() => import("../debug/EnvProbe"));
// `postprocessing` sono ~15 KB gzip: non devono stare sul percorso del primo
// frame, e su mobile il bloom non si accende nemmeno (task 8.27).
const PostFX = lazy(() => import("./PostFX"));

/**
 * Il post-processing monta solo dopo il primo frame con la bottiglia (task
 * 8.27): il suo chunk esce dal JavaScript del primo frame (budget 9.1) e i
 * suoi shader non si sommano a quelli della scena nello stesso frame. Il
 * prezzo è un primo frame senza bloom né vignetta, coperto dal Loader.
 *
 * Su mobile monta comunque: senza bloom, ma è il composer a fare l'antialias
 * (il contesto ha `antialias: false`), e senza i bordi del vetro seghettano.
 */
function DeferredPostFX() {
  const [on, setOn] = useState(false);
  useFrame(() => {
    if (!on) setOn(true);
  });
  return on ? (
    <Suspense fallback={null}>
      <PostFX />
    </Suspense>
  ) : null;
}

/**
 * Il cuore del frame: calcola lo stato da `p` e **poi** disegna.
 *
 * Il Canvas gira con `frameloop="never"` e viene avanzato da qui, dentro
 * l'unico ticker del sito (`core/Ticker.ts`). Con il loop di R3F attivo ci
 * sarebbero due `requestAnimationFrame` e nessuna garanzia su chi gira prima:
 * la scena potrebbe disegnare con la `p` del frame precedente, cioè un frame
 * di ritardo su ogni transizione.
 */
/**
 * Il renderer (spec 6.1). Costante a livello di modulo e non oggetto inline:
 * R3F confronta questo oggetto con il renderer a ogni render e, se non
 * combacia, gli riapplica tutto.
 *
 * `antialias: false` perché l'antialias lo fa il composer (task 8.15): con
 * entrambi si paga due volte. `alpha: true` perché questo canvas sta **sopra**
 * quello dello sfondo e deve lasciarlo vedere.
 */
const GL = {
  antialias: false,
  alpha: true,
  powerPreference: "high-performance",
  outputColorSpace: THREE.SRGBColorSpace,
  toneMapping: THREE.AgXToneMapping,
  toneMappingExposure: 1,
} as const;

/**
 * Moto ridotto (spec 5.1.9, task 8.24): la scena va a gradini e il canvas
 * sfuma, invece di girare la bottiglia per tutta la corsa. Lo sfondo resta
 * sulla `p` continua: è morbido di suo, e a gradini cambierebbe colore di
 * scatto proprio mentre la bottiglia è sparita.
 */
function reducedMotion(progress: Progress, canvas: HTMLCanvasElement) {
  // la corsa in atto: `step:enter` copre anche il salto da `#step-N`
  let from = progress.target;
  let to = progress.target;
  const onLeave = (e: Event) => {
    ({ from, to } = (e as CustomEvent<StepLeaveDetail>).detail);
  };
  const onEnter = (e: Event) => {
    from = to = (e as CustomEvent<StepEnterDetail>).detail.step;
  };
  progress.addEventListener("step:leave", onLeave);
  progress.addEventListener("step:enter", onEnter);
  const pose: ReducedPose = { p: 0, alpha: 1 };
  let alpha = 1;
  return {
    apply(mapper: StateMapper) {
      reducedPose(progress.p, from, to, pose);
      const { hero, step, finale } = mapper.apply(progress.p).background;
      const s = mapper.apply(pose.p);
      s.background.hero = hero;
      s.background.step = step;
      s.background.finale = finale;
      // si scrive solo quando cambia: a riposo nessuna stringa nel loop
      if (pose.alpha !== alpha) canvas.style.opacity = String((alpha = pose.alpha));
      return s;
    },
    dispose() {
      progress.removeEventListener("step:leave", onLeave);
      progress.removeEventListener("step:enter", onEnter);
      canvas.style.opacity = "";
    },
  };
}

function Driver() {
  const camera = useThree((s) => s.camera);
  const advance = useThree((s) => s.advance);
  const setDpr = useThree((s) => s.setDpr);
  const canvas = useThree((s) => s.gl.domElement);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const progress = sharedProgress();
    const vp = sharedViewport();
    const mapper = sharedMapper(vp.state);
    const ridotto = reduced ? reducedMotion(progress, canvas) : undefined;
    const adattivo = new AdaptiveDpr();
    let dpr = vp.state.dpr;
    // le ancore sono in coordinate schermo: a ogni resize i pivot si rifanno.
    // Il DPR torna al tetto da sé: lo riapplica la prop `dpr` del Canvas
    const stopVp = vp.subscribe((s) => {
      mapper.prepare(s);
      dpr = s.dpr;
      adattivo.reset();
    });
    const stopTick = onTick((time, delta) => {
      const nuovo = adattivo.feed(delta, dpr);
      if (nuovo !== null) setDpr((dpr = nuovo));
      const s = ridotto ? ridotto.apply(mapper) : mapper.apply(progress.p);
      camera.position.copy(s.camera.position);
      camera.lookAt(s.camera.look);
      advance(time * 1000);
    });
    return () => {
      stopVp();
      stopTick();
      ridotto?.dispose();
    };
  }, [camera, advance, setDpr, canvas, reduced]);

  return null;
}

/** frame da disegnare dopo la compilazione prima di dire "pronta" */
const READY_FRAMES = 1;

/**
 * Carica sulla GPU le texture di tutti i materiali in scena. La compilazione
 * non lo fa, e un draw nemmeno finché l'oggetto è fuori dal frustum: con
 * `intro` a 0 le bottiglie stanno sotto il frame, e l'etichetta salirebbe
 * caricando la sua texture sul primo frame in cui entra in vista.
 */
function uploadTextures(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      for (const v of Object.values(mat)) {
        if (v instanceof THREE.Texture) gl.initTexture(v);
      }
    }
  });
}

/**
 * Dice al Loader che la scena è pronta (task 8.22). Monta dentro la stessa
 * Suspense della bottiglia, quindi solo a GLB arrivato e modelli costruiti.
 *
 * La PMREM dell'ambiente c'è già: `LightRig` la genera in un effetto e monta
 * fuori da questa Suspense, quindi prima. `compileAsync` compila i programmi
 * con l'ambiente dentro, in parallelo dove il driver lo permette
 * (`KHR_parallel_shader_compile`), invece di bloccare il primo frame; poi si
 * caricano le texture e si aspetta un frame disegnato. Tutto sotto il Loader,
 * con `intro` a 0: scena spenta ma montata.
 */
function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const frames = useRef(-1);

  useEffect(() => {
    let vivo = true;
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (!vivo) return;
        uploadTextures(gl, scene);
        frames.current = 0;
      });
    return () => {
      vivo = false;
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    if (frames.current < 0 || frames.current > READY_FRAMES) return;
    if (++frames.current > READY_FRAMES) setSceneReady();
  });

  return null;
}

/**
 * Lo strato WebGL della scena (spec 4.2 strato 3): trasparente, sopra il
 * canvas dello sfondo: la bottiglia, la gamma e il post-processing.
 */
export function Stage({
  className,
  onContextLost,
}: {
  className?: string;
  /** il contesto WebGL è perso: l'esperienza passa alla versione statica */
  onContextLost?: () => void;
}) {
  const vp = useViewport();
  return (
    <Canvas
      id="gl"
      className={className}
      frameloop="never"
      dpr={vp.dpr}
      gl={GL}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 0, 17] }}
      onCreated={({ gl }) => {
        if (onContextLost) gl.domElement.addEventListener("webglcontextlost", onContextLost);
      }}
    >
      <Driver />
      <LightRig />
      <Lights />
      {/* la bottiglia sospende finché il GLB non è arrivato: il fondo è già
          nero, quindi il fallback è il nulla e non un lampo */}
      <Suspense fallback={null}>
        <Bottle />
        <Carousel />
        <SceneReady />
        <DeferredPostFX />
      </Suspense>
      {DEBUG_MODE === "env" && (
        <Suspense fallback={null}>
          <EnvProbe />
        </Suspense>
      )}
    </Canvas>
  );
}

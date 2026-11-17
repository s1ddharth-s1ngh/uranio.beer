import { lazy, Suspense, useEffect, useRef } from "react";
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
import { sharedPointer } from "../core/Pointer.ts";
import { bottleRise, sharedIntro } from "../core/Intro.ts";
import { onTick, tickerWakes } from "../core/Ticker.ts";
import { DEBUG_MODE } from "../debug/registry";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { isSceneReady, setAssetProgress, setSceneReady } from "../lib/assetProgress";
import { Bottle } from "./Bottle";
import { Carousel } from "./Carousel";
import { HeroProps } from "./HeroProps";
import { LightRig } from "./Environment";
import { Lights } from "./Lights";
import { Stars } from "./Stars";

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
 * Si disegna dritti sullo schermo, senza post-processing (2026-11-17): bloom,
 * FXAA, vignetta e grana volevano una render target a mezza precisione a
 * schermo intero e tre passaggi in più a ogni frame, cioè banda di memoria,
 * la prima cosa che manca a una GPU integrata o a un telefono. L'antialias
 * torna al contesto (MSAA sul framebuffer, che sui telefoni si risolve quasi
 * gratis in memoria di tile). Niente tone mapping: col composer three non lo
 * applicava (la scena finiva in una render target, e `postprocessing` senza
 * `ToneMappingEffect` converte solo in sRGB), quindi così il colore resta
 * quello di prima. `alpha: true` perché dietro al canvas c'è la scritta
 * gigante del finale, nel DOM.
 */
const GL = {
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
  outputColorSpace: THREE.SRGBColorSpace,
  toneMapping: THREE.NoToneMapping,
} as const;

/**
 * Moto ridotto (spec 5.1.9, task 8.24): la scena va a gradini e il canvas
 * sfuma, invece di girare la bottiglia per tutta la corsa.
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
      // si scrive solo quando cambia: a riposo nessuna stringa nel loop
      if (pose.alpha !== alpha) canvas.style.opacity = String((alpha = pose.alpha));
      return mapper.apply(pose.p);
    },
    dispose() {
      progress.removeEventListener("step:leave", onLeave);
      progress.removeEventListener("step:enter", onEnter);
      canvas.style.opacity = "";
    },
  };
}

/** scratch del frame: la protagonista proiettata sullo schermo */
const _schermo = new THREE.Vector3();

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
    // il cursore si avanza qui, una volta per frame e prima di disegnare: lo
    // leggono in tre (bottiglia, anello, luci). Col moto ridotto non si
    // aggancia nemmeno, e resta spento
    const pointer = sharedPointer();
    pointer.reset();
    const stopPointer = reduced ? undefined : pointer.attach(window);
    const intro = sharedIntro();
    let dpr = vp.state.dpr;
    let risvegli = tickerWakes();
    // le ancore sono in coordinate schermo: a ogni resize i pivot si rifanno.
    // Il DPR torna al tetto da sé: lo riapplica la prop `dpr` del Canvas
    const stopVp = vp.subscribe((s) => {
      mapper.prepare(s);
      dpr = s.dpr;
      adattivo.reset();
    });
    const stopTick = onTick((time, delta) => {
      if (tickerWakes() !== risvegli) {
        risvegli = tickerWakes();
        adattivo.reset();
      }
      // sotto il Loader i frame sono lenti per forza (compilazione, texture):
      // contarli abbasserebbe il DPR prima ancora che la scena si veda
      const nuovo = isSceneReady() ? adattivo.feed(delta, dpr) : null;
      if (nuovo !== null) setDpr((dpr = nuovo));
      if (!reduced) pointer.update(delta);
      const s = ridotto ? ridotto.apply(mapper) : mapper.apply(progress.p);
      camera.position.copy(s.camera.position);
      camera.lookAt(s.camera.look);
      // dove sta la protagonista sullo schermo decide quanto il cursore le è
      // vicino: lo calcola il Driver, una volta, perché bottiglia e luci lo
      // leggono entrambe (`core/Pointer.ts`). All'arrivo resta ferma, per non
      // sommare due movimenti
      camera.updateMatrixWorld();
      _schermo.copy(s.pivot).project(camera);
      pointer.look(_schermo.x, -_schermo.y, s.look * bottleRise(intro.value), pointer.hero);
      // In SECONDI. Con `frameloop="never"` R3F ricava il delta di `useFrame`
      // e `clock.elapsedTime` dal timestamp che riceve qui, così com'è: col
      // vecchio `time * 1000` arrivavano in millisecondi, e ogni onda pensata
      // in secondi girava mille volte più veloce. Era il tremolio delle
      // bottiglie (la vita a riposo, periodo 5 s, diventata 5 ms: a 60 fps un
      // rumore) e il tappo sospeso che girava a caso; oggi farebbe correre
      // stelle e stelle cadenti, che contano il tempo sui delta
      advance(time);
    });
    return () => {
      stopVp();
      stopTick();
      stopPointer?.();
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
 * Lo strato WebGL della scena (spec 4.2 strato 3): trasparente, sopra il nero
 * della pagina e la scritta gigante del finale: il cielo, le bottiglie, faro e
 * piedistallo.
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
  const reduced = usePrefersReducedMotion();
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
      <Stars reduced={reduced} />
      {/* la bottiglia sospende finché il GLB non è arrivato: il fondo è già
          nero e stellato, quindi il fallback è il nulla e non un lampo */}
      <Suspense fallback={null}>
        <Bottle />
        <Carousel />
        <HeroProps />
        <SceneReady />
      </Suspense>
      {DEBUG_MODE === "env" && (
        <Suspense fallback={null}>
          <EnvProbe />
        </Suspense>
      )}
    </Canvas>
  );
}

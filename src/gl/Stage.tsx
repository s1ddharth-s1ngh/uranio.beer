import { lazy, Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA } from "../config/solvePivot.ts";
import { sharedProgress } from "../core/Progress.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { onTick } from "../core/Ticker.ts";
import { DEBUG_MODE } from "../debug/registry";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { Bottle } from "./Bottle";
import { LightRig } from "./Environment";
import { Lights } from "./Lights";

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

function Driver() {
  const camera = useThree((s) => s.camera);
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    const progress = sharedProgress();
    const vp = sharedViewport();
    const mapper = sharedMapper(vp.state);
    // le ancore sono in coordinate schermo: a ogni resize i pivot si rifanno
    const stopVp = vp.subscribe((s) => mapper.prepare(s));
    const stopTick = onTick((time) => {
      const s = mapper.apply(progress.p);
      camera.position.copy(s.camera.position);
      camera.lookAt(s.camera.look);
      advance(time * 1000);
    });
    return () => {
      stopVp();
      stopTick();
    };
  }, [camera, advance]);

  return null;
}

/**
 * Lo strato WebGL della scena (spec 4.2 strato 3): trasparente, sopra il
 * canvas dello sfondo. Ci vivranno bottiglie, faro, piedistallo e
 * post-processing.
 */
export function Stage({ className }: { className?: string }) {
  const vp = useViewport();
  return (
    <Canvas
      id="gl"
      className={className}
      frameloop="never"
      dpr={vp.dpr}
      gl={GL}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 0, 17] }}
    >
      <Driver />
      <LightRig />
      <Lights />
      {/* la bottiglia sospende finché il GLB non è arrivato: il fondo è già
          nero, quindi il fallback è il nulla e non un lampo */}
      <Suspense fallback={null}>
        <Bottle />
      </Suspense>
      {DEBUG_MODE === "env" && (
        <Suspense fallback={null}>
          <EnvProbe />
        </Suspense>
      )}
    </Canvas>
  );
}

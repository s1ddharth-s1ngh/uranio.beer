import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOTTLE, CAP } from "../config/bottle.ts";
import { FILL, RIM, SPOT } from "../config/lights.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { registerDebug } from "../debug/registry";
import { sharedViewport } from "../hooks/useViewport";

/** scratch: allocare un Vector3 per frame vuol dire regalarne 60 al secondo */
const _v = new THREE.Vector3();

/** la cima della bottiglia in coordinate locali del pivot */
const CIMA_LOCALE = CAP.maxY - BOTTLE.centerY;

/**
 * Le luci della scena (spec 6.4), a parte l'ambiente riflesso che sta in
 * `Environment.tsx`.
 *
 * Lo spot **segue la cima della bottiglia**: la bottiglia si muove e si
 * inclina a ogni step, e un faretto puntato su un punto fisso le finirebbe
 * addosso di sbieco. La posizione della cima si ricava dallo stesso stato che
 * muove la bottiglia, quindi le due cose non possono sfasarsi.
 */
export function Lights() {
  const spot = useRef<THREE.SpotLight>(null);
  // il bersaglio dello spot è un oggetto vero in scena: three legge la sua
  // matrice mondo, e un oggetto non montato non ce l'ha aggiornata
  const target = useMemo(() => new THREE.Object3D(), []);

  const tuning = useMemo(
    () => ({ spotGain: SPOT.gain, rim: RIM.intensity, fill: FILL.intensity }),
    [],
  );
  const rimA = useRef<THREE.DirectionalLight>(null);
  const rimB = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);

  useEffect(
    () =>
      registerDebug({
        title: "luci",
        target: tuning,
        knobs: {
          spotGain: { min: 0, max: 60, step: 0.5 },
          rim: { min: 0, max: 8, step: 0.05 },
          fill: { min: 0, max: 2, step: 0.01 },
        },
        onChange: () => {
          if (rimA.current) rimA.current.intensity = tuning.rim;
          if (rimB.current) rimB.current.intensity = tuning.rim;
          if (fill.current) fill.current.intensity = tuning.fill;
        },
      }),
    [tuning],
  );

  const mapper = sharedMapper(sharedViewport().state);
  useFrame(() => {
    const s = mapper.state;
    _v.set(0, CIMA_LOCALE, 0).applyEuler(s.rotation).add(s.pivot);
    target.position.copy(_v);
    target.updateMatrixWorld();

    const l = spot.current;
    if (!l) return;
    l.position.set(
      _v.x + SPOT.offset[0],
      _v.y + SPOT.offset[1],
      _v.z + SPOT.offset[2],
    );
    l.intensity = s.spot * tuning.spotGain;
  });

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={spot}
        target={target}
        angle={SPOT.angle}
        penumbra={SPOT.penumbra}
        decay={SPOT.decay}
        color={SPOT.color}
        intensity={0}
      />
      {/* due rim light specchiate: la silhouette resta leggibile anche quando
          il corpo della bottiglia è spento dalle maschere */}
      <directionalLight
        ref={rimA}
        position={[RIM.position[0], RIM.position[1], RIM.position[2]]}
        intensity={RIM.intensity}
        color={RIM.color}
      />
      <directionalLight
        ref={rimB}
        position={[-RIM.position[0], RIM.position[1], RIM.position[2]]}
        intensity={RIM.intensity}
        color={RIM.color}
      />
      <hemisphereLight
        ref={fill}
        intensity={FILL.intensity}
        color={FILL.sky}
        groundColor={FILL.ground}
      />
    </>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOTTLE, CAP } from "../config/bottle.ts";
import { CAP_MOTION } from "../config/cap.ts";
import { FILL, RIM, SPOT } from "../config/lights.ts";
import { capPose, type CapPose } from "../core/Cap.ts";
import { bottleRise, sharedIntro } from "../core/Intro.ts";
import { lookQuaternion, sharedPointer } from "../core/Pointer.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { registerDebug } from "../debug/registry";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { screenPoint } from "./screenPoint.ts";

/** scratch: allocare un Vector3 per frame vuol dire regalarne 60 al secondo */
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _sospeso = new THREE.Vector3();
const POSA: CapPose = { pop: 0, fly: 0, spin: 0, tumble: 0 };

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
  const intro = sharedIntro();
  const pointer = sharedPointer();
  const camera = useThree((s) => s.camera);
  const vp = useViewport();
  const hover = vp.mobile || vp.portrait ? CAP_MOTION.hover.portrait : CAP_MOTION.hover.desktop;
  useFrame(() => {
    const s = mapper.state;
    const sale = bottleRise(intro.value);
    // la stessa rotazione verso il cursore della bottiglia (`gl/Bottle.tsx`):
    // le luci la seguono, o la faccia girata uscirebbe dal fascio
    lookQuaternion(pointer, s.look * sale, _q);
    _v.set(0, CIMA_LOCALE, 0).applyEuler(s.rotation).applyQuaternion(_q).add(s.pivot);
    // il tappo staccato si porta via lo spot: sospeso accanto alla bottiglia
    // è l'unica cosa accesa fuori dalla fascia, e senza luce sarebbe un
    // disco scuro (`config/cap.ts`)
    const vola = capPose(s.cap, POSA).fly;
    if (vola > 0) {
      camera.updateMatrixWorld();
      _v.lerp(screenPoint(camera, hover.screen, hover.depth, _sospeso), vola);
    }
    target.position.copy(_v);
    target.updateMatrixWorld();

    const l = spot.current;
    if (l) {
      l.position.set(
        _v.x + SPOT.offset[0],
        _v.y + SPOT.offset[1],
        _v.z + SPOT.offset[2],
      );
      // all'ingresso lo spot si accende insieme alla bottiglia che arriva
      const forza = s.spot + (CAP_MOTION.spot - s.spot) * vola;
      l.intensity = forza * tuning.spotGain * sale;
    }
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

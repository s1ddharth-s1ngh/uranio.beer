import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BOTTLE, CAP, MODEL_URL } from "../config/bottle.ts";
import { CAP_MOTION } from "../config/cap.ts";
import { FACE } from "../config/lights.ts";
import { capFlash, capPose, type CapPose } from "../core/Cap.ts";
import { bottleDrop, bottleRise, bottleSpin, sharedIntro } from "../core/Intro.ts";
import { sharedPointer } from "../core/Pointer.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { makeGlowTexture } from "./glowTexture.ts";
import { screenPoint } from "./screenPoint.ts";
import { setBottleLight } from "./materials/patchBottle.ts";
import { prepareBottle } from "./prepareBottle.ts";

// scratch del frame: allocare vettori qui dentro vorrebbe dire regalarne
// decine al secondo al garbage collector (task 8.27)
const _qInv = new THREE.Quaternion();
const _qOpen = new THREE.Quaternion();
const _qAxis = new THREE.Quaternion();
const _e = new THREE.Euler();
const _chiuso = new THREE.Vector3();
const _asse = new THREE.Vector3();
const _sospeso = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const ASSE_Y = new THREE.Vector3(0, 1, 0);
const ASSE_X = new THREE.Vector3(1, 0, 0);
/** il centro del tappo nello spazio del modello: il punto attorno a cui gira */
const CENTRO_TAPPO = new THREE.Vector3(0, CAP.centerY, 0);
const POSA: CapPose = { pop: 0, fly: 0, spin: 0, tumble: 0 };

interface Hover {
  screen: readonly [number, number];
  depth: number;
}

/**
 * Il tappo, staccato di `open` (0–1), in mondo e poi nello spazio della mesh.
 *
 * La mesh del tappo vive dentro `inner` (spostato di −centerY) dentro il
 * pivot, e la sua geometria sta già all'altezza del collo. Per metterla in un
 * punto `P` del mondo con un orientamento `Q`, girando attorno al **suo**
 * centro `C` e non all'origine del modello:
 *
 *   quaternion = Qp⁻¹ · Q
 *   position   = (0, centerY, 0) + Qp⁻¹ · (P − Pp) − quaternion · C
 *
 * con `Pp`, `Qp` posizione e orientamento del pivot. A `open` 0 vale
 * l'identità: il tappo è sul collo come nel modello.
 *
 * Funzione di modulo e non corpo del `useFrame`, come `disponi` del
 * carosello: il componente non scrive dentro valori che gli arrivano dal
 * render.
 */
function posaTappo(
  tappo: THREE.Object3D,
  pivot: THREE.Object3D,
  camera: THREE.Camera,
  open: number,
  hover: Hover,
) {
  const qp = pivot.quaternion;
  if (open <= 1e-4) {
    tappo.position.set(0, 0, 0);
    tappo.quaternion.identity();
    return;
  }
  const posa = capPose(open, POSA);

  // dove sarebbe da chiuso, e l'asse lungo cui salta
  _chiuso.set(0, CAP.centerY - BOTTLE.centerY, 0).applyQuaternion(qp).add(pivot.position);
  _asse.copy(ASSE_Y).applyQuaternion(qp);
  screenPoint(camera, hover.screen, hover.depth, _sospeso);
  _p.copy(_chiuso).addScaledVector(_asse, posa.pop).lerp(_sospeso, posa.fly);

  // orientamento: da quello della bottiglia a quello da sospeso, più la
  // capriola a metà volo e i giri sul proprio asse
  _e.set(CAP_MOTION.tilt, 0, CAP_MOTION.roll);
  _qOpen.setFromEuler(_e);
  const q = tappo.quaternion.copy(qp).slerp(_qOpen, posa.fly);
  q.multiply(_qAxis.setFromAxisAngle(ASSE_X, posa.tumble));
  q.multiply(_qAxis.setFromAxisAngle(ASSE_Y, posa.spin));

  // e nello spazio della mesh
  _qInv.copy(qp).invert();
  q.premultiply(_qInv);
  tappo.position
    .set(0, BOTTLE.centerY, 0)
    .add(_c.copy(_p).sub(pivot.position).applyQuaternion(_qInv))
    .sub(_c.copy(CENTRO_TAPPO).applyQuaternion(q));
}

/**
 * La bottiglia protagonista.
 *
 * Non ha stato suo: a ogni frame copia dallo `StateMapper` posizione,
 * rotazione e luce calcolate da `p`. Il `useFrame` gira dentro l'`advance()`
 * del nostro ticker (vedi `Stage.tsx`), quindi lo stato che legge è già
 * quello di questo frame, non del precedente. Sopra lo stato si somma solo il
 * cursore (`core/Pointer.ts`), e solo quando le è vicino.
 *
 * A riposo è **ferma**. Fino al 2026-11-17 fluttuava, dondolava e nel finale
 * oscillava, e il tappo sospeso girava e saliva e scendeva: al proprietario
 * sembrava una bottiglia che trema ("fermiamo questa bottiglia che sta
 * tremolando da due ore"). La luce sul tappo staccato è lo spot della cima,
 * che lo segue (`gl/Lights.tsx`).
 */
export function Bottle() {
  // `false` disattiva Draco: il GLB è compresso meshopt (che drei aggancia da
  // sé) e il decoder Draco punta a gstatic — una richiesta di rete per un
  // decoder che a questo file non serve.
  const { scene } = useGLTF(MODEL_URL, false);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const vp = useViewport();
  const pivot = useRef<THREE.Group>(null);
  const lampo = useRef<THREE.Sprite>(null);

  const prepared = useMemo(
    () =>
      prepareBottle(scene, {
        lowEnd: vp.mobile,
        maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
      }),
    [scene, vp.mobile, gl],
  );

  // geometrie e materiali sono nostri (clonati dalla cache di useGLTF): se non
  // si liberano, ogni passaggio desktop↔mobile ne lascia una copia sulla GPU
  useEffect(() => () => prepared.dispose(), [prepared]);

  const bagliore = useMemo(
    () =>
      makeGlowTexture([
        [0, "rgba(255,255,255,1)"],
        [0.25, "rgba(255,214,190,0.6)"],
        [0.6, "rgba(219,68,66,0.18)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    [],
  );
  useEffect(() => () => bagliore.dispose(), [bagliore]);

  const mapper = sharedMapper(sharedViewport().state);
  const intro = sharedIntro();
  const pointer = sharedPointer();
  const reduced = usePrefersReducedMotion();
  const hover = vp.mobile || vp.portrait ? CAP_MOTION.hover.portrait : CAP_MOTION.hover.desktop;
  useFrame(() => {
    const g = pivot.current;
    if (!g) return;
    const s = mapper.state;

    g.position.copy(s.pivot);
    g.rotation.copy(s.rotation);

    // l'ingresso: arriva dal basso finendo un mezzo giro e si accende mentre
    // sale; a `intro` 1 i tre termini valgono 0, 0 e 1, lo stato è intatto
    const sale = bottleRise(intro.value);
    g.position.y += bottleDrop(intro.value);
    g.rotation.y -= bottleSpin(intro.value);

    // il cursore, per ultimo e in coordinate mondo: lo calcola il Driver
    // (`Stage.tsx`), già pesato da quanto le è vicino e spento all'arrivo
    g.quaternion.premultiply(pointer.hero);

    setBottleLight(prepared.uniforms, sale, s.face * FACE.gain * sale);

    // il tappo: staccato, vola accanto alla bottiglia e resta lì, fermo
    const apertura = s.cap;
    camera.updateMatrixWorld();
    posaTappo(prepared.meshes.tappo, g, camera, apertura, hover);

    // il lampo alla bocca nel momento in cui salta: dove stava il tappo
    const f = lampo.current;
    if (f) {
      const v = reduced ? 0 : capFlash(apertura);
      f.visible = v > 0;
      if (v > 0) {
        _chiuso.set(0, CAP.minY - BOTTLE.centerY, 0).applyQuaternion(g.quaternion).add(g.position);
        f.position.copy(_chiuso);
        f.scale.setScalar(CAP_MOTION.flash.scale * (0.6 + 0.4 * v));
        (f.material as THREE.SpriteMaterial).opacity = CAP_MOTION.flash.opacity * v;
      }
    }
  });

  return (
    <>
      <primitive ref={pivot} object={prepared.pivot} />
      <sprite ref={lampo} visible={false}>
        <spriteMaterial
          map={bagliore}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </>
  );
}

// Il GLB parte a scaricare appena questo modulo arriva, non quando il
// componente monta: sono 320 KB e il preloader (task 8.22) ne mostra il
// progresso reale.
useGLTF.preload(MODEL_URL, false);

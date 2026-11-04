import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BAND_ORDER, BANDS, BOTTLE, CAP, MODEL_URL } from "../config/bottle.ts";
import { CAP_MOTION } from "../config/cap.ts";
import { REST_LIFE } from "../config/keyframes.ts";
import { FACE } from "../config/lights.ts";
import { capFlash, capPose, type CapPose } from "../core/Cap.ts";
import { bottleDrop, bottleRise, bottleSpin, sharedIntro } from "../core/Intro.ts";
import { lookQuaternion, sharedPointer } from "../core/Pointer.ts";
import { sharedProgress } from "../core/Progress.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { DEBUG_MODE, registerDebug } from "../debug/registry";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { makeGlowTexture } from "./glowTexture.ts";
import { screenPoint } from "./screenPoint.ts";
import {
  applyMasks,
  applyTuning,
  readTuning,
  TUNING_RANGE,
  type BottleMasks,
} from "./materials/patchBottle.ts";
import { prepareBottle } from "./prepareBottle.ts";

/** quanto resta accesa ogni fascia nel ciclo di `?debug=bands`, in secondi */
const BANDS_CYCLE_S = 1.6;

/** un'onda di periodo `periodo` secondi */
const onda = (t: number, periodo: number) => Math.sin((t * Math.PI * 2) / periodo);

// scratch del frame: allocare vettori qui dentro vorrebbe dire regalarne
// decine al secondo al garbage collector (task 8.27)
const _qLook = new THREE.Quaternion();
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
/** le maschere del tappo: quelle della bottiglia, con la fascia che si spegne quando vola */
const MASCHERE_TAPPO: BottleMasks = {
  reveal: 0,
  revealY: 0,
  focus: 0,
  focusY: 0,
  focusHalf: 0,
  focusAngleHalf: 0,
  sweep: 0,
  sweepAmt: 0,
};

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
  spinRiposo: number,
  bob: number,
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
  _sospeso.y += bob;
  _p.copy(_chiuso).addScaledVector(_asse, posa.pop).lerp(_sospeso, posa.fly);

  // orientamento: da quello della bottiglia a quello da sospeso, più la
  // capriola a metà volo e i giri sul proprio asse
  _e.set(CAP_MOTION.tilt, 0, CAP_MOTION.roll);
  _qOpen.setFromEuler(_e);
  const q = tappo.quaternion.copy(qp).slerp(_qOpen, posa.fly);
  q.multiply(_qAxis.setFromAxisAngle(ASSE_X, posa.tumble));
  q.multiply(_qAxis.setFromAxisAngle(ASSE_Y, posa.spin + spinRiposo));

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
 * rotazione e maschere calcolate da `p`. Il `useFrame` gira dentro
 * l'`advance()` del nostro ticker (vedi `Stage.tsx`), quindi lo stato che
 * legge è già quello di questo frame, non del precedente. Sopra lo stato si
 * sommano tre disturbi che non dipendono da `p`: la vita a riposo, il cursore
 * (`core/Pointer.ts`) e la rotazione lenta del tappo sospeso. La luce sul
 * tappo staccato è lo spot della cima, che lo segue (`gl/Lights.tsx`).
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

  // Le manopole degli shader nel pannello (spec 8.5): sono i valori che si
  // regolano guardando, non calcolando — quanto è sfumato il bordo di una
  // fascia, quanto resta acceso il resto della bottiglia.
  useEffect(() => {
    const knobs = readTuning(prepared.uniforms);
    return registerDebug({
      title: "shader bottiglia",
      target: knobs,
      knobs: TUNING_RANGE,
      onChange: () => {
        applyTuning(prepared.uniforms, knobs);
        applyTuning(prepared.capUniforms, knobs);
      },
    });
  }, [prepared]);

  const mapper = sharedMapper(sharedViewport().state);
  const progress = sharedProgress();
  const intro = sharedIntro();
  const pointer = sharedPointer();
  const reduced = usePrefersReducedMotion();
  const hover = vp.mobile || vp.portrait ? CAP_MOTION.hover.portrait : CAP_MOTION.hover.desktop;
  // il peso della vita a riposo: parte pieno, la pagina si apre ferma
  const quiete = useRef(1);
  // la rotazione lenta del tappo sospeso: un accumulo e non `t × velocità`,
  // perché moltiplicata per quanto è staccato farebbe girare il tappo a
  // raffica nel momento in cui si stacca, tanto più quanto è tardi
  const spinTappo = useRef(0);
  useFrame(({ clock }, delta) => {
    const g = pivot.current;
    if (!g) return;
    const s = mapper.state;

    g.position.copy(s.pivot);
    g.rotation.copy(s.rotation);

    // Vita a riposo (spec 7.4), sommata sopra lo stato di `p`. Il peso insegue
    // "fermo / in corsa" con una costante di tempo invece di scattare: così la
    // vita si spegne mentre la transizione parte e si riaccende dopo
    // l'atterraggio, senza salti in nessuno dei due momenti.
    const q = (quiete.current +=
      ((progress.moving ? 0 : 1) - quiete.current) *
      (1 - Math.exp(-delta / REST_LIFE.tau)));
    const t = clock.elapsedTime;
    if (!reduced && q > 1e-4) {
      g.position.y += q * REST_LIFE.y.amp * onda(t, REST_LIFE.y.period);
      g.rotation.z += q * REST_LIFE.z.amp * onda(t, REST_LIFE.z.period);
      g.rotation.y +=
        q *
        s.background.finale *
        REST_LIFE.finaleSpin.amp *
        onda(t, REST_LIFE.finaleSpin.period);
    }

    // l'ingresso: arriva dal basso finendo un mezzo giro e si accende mentre
    // sale; a `intro` 1 i tre termini valgono 0, 0 e 1, lo stato è intatto
    const sale = bottleRise(intro.value);
    g.position.y += bottleDrop(intro.value);
    g.rotation.y -= bottleSpin(intro.value);

    // il cursore, per ultimo e in coordinate mondo (vedi `lookQuaternion`):
    // da ferma all'arrivo, per non sommare due movimenti
    g.quaternion.premultiply(lookQuaternion(pointer, s.look * sale, _qLook));

    applyMasks(prepared.uniforms, s.uniforms, sale, s.face * FACE.gain * sale);

    // il tappo: staccato, si spegne con la fascia accesa solo finché è sul
    // collo, poi resta acceso com'è (le maschere lo crederebbero ancora lì)
    const apertura = s.cap;
    const vola = capPose(apertura, POSA).fly;
    spinTappo.current = reduced ? 0 : (spinTappo.current + delta * CAP_MOTION.idle.spin * vola) % (Math.PI * 2);
    const bob = reduced ? 0 : vola * CAP_MOTION.idle.bobAmp * onda(t, CAP_MOTION.idle.bobPeriod);
    camera.updateMatrixWorld();
    posaTappo(prepared.meshes.tappo, g, camera, apertura, spinTappo.current, bob, hover);
    Object.assign(MASCHERE_TAPPO, s.uniforms);
    MASCHERE_TAPPO.focus *= 1 - vola;
    applyMasks(prepared.capUniforms, MASCHERE_TAPPO, sale);

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

    if (DEBUG_MODE === "bands") {
      // `?debug=bands`: la fascia accesa gira sulle quattro, ferma su ognuna,
      // per controllare che ciascuna accenda esattamente il suo blocco di
      // testo. La bottiglia resta dove la mette `p`: si va su uno step del
      // retro con la rotella e si guarda.
      const i =
        Math.floor(clock.elapsedTime / BANDS_CYCLE_S) % BAND_ORDER.length;
      const fascia = BANDS[BAND_ORDER[i]];
      applyMasks(prepared.uniforms, {
        ...s.uniforms,
        reveal: 0,
        focus: 1,
        focusY: fascia.y,
        focusHalf: fascia.half,
        focusAngleHalf: fascia.angleHalf,
      });
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

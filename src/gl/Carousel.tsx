import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MODEL_URL, SHADER } from "../config/bottle.ts";
import { GAMMA, RING, ringFor } from "../config/beers.ts";
import { INTRO } from "../config/intro.ts";
import { POINTER } from "../config/pointer.ts";
import { slotOffset, slotPose, type SlotPose } from "../core/Carousel.ts";
import { sharedIntro, slotRise } from "../core/Intro.ts";
import { lookQuaternion, sharedPointer } from "../core/Pointer.ts";
import { sharedMapper, type SceneState } from "../core/StateMapper.ts";
import { applyMasks, type BottleMasks } from "./materials/patchBottle.ts";
import {
  cloneBottle,
  prepareBottle,
  type PreparedBottle,
} from "./prepareBottle.ts";
import { sharedViewport, useViewport } from "../hooks/useViewport";

/**
 * Le altre non usano nessuna maschera: niente cima accesa, niente fascia,
 * niente lama. Solo `uDim`, che passa a parte.
 */
const SPENTE: BottleMasks = {
  reveal: 0,
  revealY: SHADER.revealY,
  focus: 0,
  focusY: 0,
  focusHalf: 0,
  focusAngleHalf: SHADER.focusAngleHalf,
  sweep: SHADER.sweepIdle,
  sweepAmt: 0,
};

// scratch riusati a ogni frame invece di allocarne di nuovi
const POSA: SlotPose = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

interface Contesto {
  t: number;
  ring: { radius: number; step: number };
  /** la parallasse dell'anello: una frazione di quella della protagonista */
  look: THREE.Quaternion;
  intro: number;
}

// riusato anche lui: un oggetto nuovo per frame è spazzatura per il GC
const CTX: Contesto = { t: 0, ring: RING.desktop, look: _q, intro: 0 };

/**
 * Mette ogni bottiglia al suo posto, sull'anello o in fila.
 *
 * Funzione di modulo e non corpo del `useFrame`: così il componente non
 * scrive dentro valori che gli arrivano dal render (regola
 * `react-hooks/immutability`).
 */
function disponi(bottiglie: readonly PreparedBottle[], s: SceneState, c: Contesto) {
  const { escape, sideDim, layout } = s.carousel;
  const { life } = GAMMA;

  for (let k = 0; k < bottiglie.length; k++) {
    const b = bottiglie[k];
    // niente da calcolare né da disegnare fuori dall'anello e dalla gamma: è
    // quasi tutta l'esperienza
    const slot = k + 1;
    const scarto = slotOffset(slot);
    b.pivot.visible = escape < 1 && (layout > 0.5 || Math.abs(scarto) <= RING.maxOffset);
    if (!b.pivot.visible) continue;

    const pose = slotPose(slot, layout, c.ring, POSA);
    // entrano ed escono dalla parte in cui stanno: chi è a sinistra arriva
    // da sinistra
    const verso = Math.sign(pose.x) || 1;
    // l'ingresso dell'hero: salgono dal basso dopo la protagonista, a coppie
    const sale = slotRise(c.intro, scarto);
    _v.set(
      pose.x + verso * GAMMA.escapeX * escape,
      pose.y + Math.sin(c.t * life.ySpeed + slot * 1.7) * life.yAmp,
      pose.z - GAMMA.escapeZ * escape,
    );
    // il cursore gira tutto l'anello attorno alla protagonista: la fila ha
    // profondità, e girarla di poco basta a sentirla
    _v.applyQuaternion(c.look);
    b.pivot.position.copy(s.pivot).add(_v);
    b.pivot.position.y -= (1 - sale) * INTRO.bottle.drop;
    b.pivot.rotation.set(
      pose.rotX + s.rotation.x,
      pose.rotY + s.rotation.y,
      pose.rotZ + s.rotation.z + Math.sin(c.t * life.zSpeed + slot) * life.zAmp,
    );
    b.pivot.quaternion.premultiply(c.look);
    applyMasks(b.uniforms, SPENTE, sideDim * pose.dim * sale);
  }
}

/**
 * Le altre bottiglie: l'anello dell'hero (step 0) e la fila della gamma
 * (ultimo step), le stesse copie in due pose.
 *
 * Lo slot 0 è la protagonista e la disegna `Bottle.tsx`: è la stessa bottiglia
 * che vive tutta l'esperienza, e duplicarla qui vorrebbe dire due bottiglie
 * da tenere in sincrono nel punto esatto in cui si guarda.
 *
 * Le posizioni sono **relative al pivot della protagonista**: la composizione
 * regge su ogni formato senza un secondo insieme di ancore, perché la
 * protagonista la posiziona già `solvePivot`.
 */
export function Carousel() {
  const { scene } = useGLTF(MODEL_URL, false);
  const gl = useThree((s) => s.gl);
  const vp = useViewport();
  const count = vp.mobile ? GAMMA.countMobile : GAMMA.count;

  const bottiglie = useMemo(() => {
    // La prima copia è una preparazione vera (è lei a possedere geometrie e
    // texture condivise), le altre sono cloni che ne riusano le geometrie e si
    // tengono solo materiali e uniform propri.
    // sempre leggere: sono piccole e accese a metà, la `transmission` e la
    // birra dentro non si vedrebbero e costano un passaggio sulla scena
    const base = prepareBottle(scene, {
      lowEnd: true,
      maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
    });
    // e senza il secondo strato di riflesso: piccole e in penombra non lo
    // mostrano, ma lo shader che lo calcola si paga in ogni loro pixel (~1 ms
    // a frame per l'anello su una GPU integrata). I cloni ereditano dai
    // materiali della base
    for (const m of [base.meshes.vetro, base.meshes.tappo]) {
      (m.material as THREE.MeshPhysicalMaterial).clearcoat = 0;
    }
    return [
      base,
      ...Array.from({ length: Math.max(0, count - 2) }, () => cloneBottle(base)),
    ];
  }, [scene, gl, count]);

  useEffect(() => {
    // l'ordine conta: i cloni liberano i materiali, la base anche le
    // geometrie, e liberare le geometrie mentre un clone le usa ancora
    // lascerebbe un buffer morto agganciato
    const copie = bottiglie;
    return () => {
      for (let i = copie.length - 1; i >= 0; i--) copie[i].dispose();
    };
  }, [bottiglie]);

  const mapper = sharedMapper(sharedViewport().state);
  const pointer = sharedPointer();
  const intro = sharedIntro();
  const ring = ringFor(vp);
  useFrame(({ clock }) => {
    const s = mapper.state;
    CTX.t = clock.elapsedTime;
    CTX.ring = ring;
    CTX.intro = intro.value;
    lookQuaternion(pointer, s.look * POINTER.ring, CTX.look);
    disponi(bottiglie, s, CTX);
  });

  return (
    <>
      {bottiglie.map((b, k) => (
        <primitive key={k} object={b.pivot} />
      ))}
    </>
  );
}

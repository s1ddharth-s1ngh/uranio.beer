import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MODEL_URL } from "../config/bottle.ts";
import { GAMMA } from "../config/beers.ts";
import { slotPose, type SlotPose } from "../core/Carousel.ts";
import { sharedMapper, type SceneState } from "../core/StateMapper.ts";
import { SHADER } from "../config/bottle.ts";
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
  sweep: SHADER.sweepIdle,
  sweepAmt: 0,
};

// la posa dello slot, riscritta a ogni frame invece di allocarne una nuova
const POSA: SlotPose = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 };

/**
 * Mette ogni bottiglia al suo posto nella fila.
 *
 * Funzione di modulo e non corpo del `useFrame`: così il componente non
 * scrive dentro valori che gli arrivano dal render (regola
 * `react-hooks/immutability`).
 */
function disponi(bottiglie: readonly PreparedBottle[], s: SceneState, t: number) {
  const { escape, sideDim } = s.carousel;
  const { life } = GAMMA;

  for (let k = 0; k < bottiglie.length; k++) {
    const b = bottiglie[k];
    // niente da calcolare né da disegnare fuori dalla gamma: è quasi tutta
    // l'esperienza
    b.pivot.visible = escape < 1;
    if (!b.pivot.visible) continue;

    const slot = k + 1;
    const pose = slotPose(slot, POSA);
    // entrano ed escono dalla parte in cui stanno: chi è a sinistra arriva
    // da sinistra
    const verso = Math.sign(pose.x) || 1;
    b.pivot.position.set(
      s.pivot.x + pose.x + verso * GAMMA.escapeX * escape,
      s.pivot.y + pose.y + Math.sin(t * life.ySpeed + slot * 1.7) * life.yAmp,
      s.pivot.z + pose.z - GAMMA.escapeZ * escape,
    );
    b.pivot.rotation.set(
      pose.rotX + s.rotation.x,
      pose.rotY + s.rotation.y,
      pose.rotZ + s.rotation.z + Math.sin(t * life.zSpeed + slot) * life.zAmp,
    );
    applyMasks(b.uniforms, SPENTE, sideDim);
  }
}

/**
 * La gamma (step 5): le bottiglie **oltre** la protagonista, in fila.
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
  useFrame(({ clock }) => disponi(bottiglie, mapper.state, clock.elapsedTime));

  return (
    <>
      {bottiglie.map((b, k) => (
        <primitive key={k} object={b.pivot} />
      ))}
    </>
  );
}

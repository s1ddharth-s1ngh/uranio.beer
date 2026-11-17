import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MODEL_URL } from "../config/bottle.ts";
import { GAMMA, RING, ringFor } from "../config/beers.ts";
import { INTRO } from "../config/intro.ts";
import { slotOffset, slotPose, type SlotPose } from "../core/Carousel.ts";
import { sharedIntro, slotRise } from "../core/Intro.ts";
import { sharedPointer, type Pointer } from "../core/Pointer.ts";
import { sharedMapper, type SceneState } from "../core/StateMapper.ts";
import { setBottleLight } from "./materials/patchBottle.ts";
import {
  cloneBottle,
  prepareBottle,
  type PreparedBottle,
} from "./prepareBottle.ts";
import { sharedViewport, useViewport } from "../hooks/useViewport";

// scratch riusati a ogni frame invece di allocarne di nuovi
const POSA: SlotPose = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

interface Contesto {
  ring: { radius: number; step: number };
  camera: THREE.Camera;
  pointer: Pointer;
}

/**
 * Mette ogni bottiglia al suo posto, sull'anello o in fila, e la gira verso
 * il cursore quanto il cursore le è vicino: ognuna per conto suo, guardando
 * dove sta lei sullo schermo. Il gruppo non si muove mai tutto insieme
 * (richiesta del 2026-11-17).
 *
 * Funzione di modulo e non corpo del `useFrame`: così il componente non
 * scrive dentro valori che gli arrivano dal render (regola
 * `react-hooks/immutability`).
 */
function disponi(
  bottiglie: readonly PreparedBottle[],
  s: SceneState,
  c: Contesto,
  intro: number,
) {
  const { escape, sideDim, layout } = s.carousel;

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
    const sale = slotRise(intro, scarto);
    _v.set(
      pose.x + verso * GAMMA.escapeX * escape,
      pose.y,
      pose.z - GAMMA.escapeZ * escape,
    );
    b.pivot.position.copy(s.pivot).add(_v);
    b.pivot.position.y -= (1 - sale) * INTRO.bottle.drop;
    b.pivot.rotation.set(
      pose.rotX + s.rotation.x,
      pose.rotY + s.rotation.y,
      pose.rotZ + s.rotation.z,
    );
    // il cursore: dove sta questa bottiglia sullo schermo, e quanto gli è
    // vicina. Ferma finché sale, come la protagonista
    _v.copy(b.pivot.position).project(c.camera);
    c.pointer.look(_v.x, -_v.y, s.look * sale, _q);
    b.pivot.quaternion.premultiply(_q);
    setBottleLight(b.uniforms, sideDim * pose.dim * sale);
  }
}

/**
 * Le altre bottiglie: il gruppo dell'hero (step 0) e la fila della gamma
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
  const camera = useThree((s) => s.camera);
  const vp = useViewport();
  const count = vp.mobile ? GAMMA.countMobile : GAMMA.count;

  const bottiglie = useMemo(() => {
    // La prima copia è una preparazione vera (è lei a possedere geometrie e
    // texture condivise), le altre sono cloni che ne riusano le geometrie e si
    // tengono solo materiali e uniform propri.
    // sempre leggere: sono piccole, e il tappo e l'etichetta del modello da
    // lontano sono triangoli più piccoli di un pixel (`geometriaLeggera`)
    const base = prepareBottle(scene, {
      lowEnd: true,
      lowPoly: true,
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
  const intro = sharedIntro();
  // un oggetto per montaggio e non per frame: sarebbe spazzatura per il GC
  const ctx = useMemo<Contesto>(
    () => ({ ring: ringFor(vp), camera, pointer: sharedPointer() }),
    [vp, camera],
  );
  useFrame(() => disponi(bottiglie, mapper.state, ctx, intro.value));

  return (
    <>
      {bottiglie.map((b, k) => (
        <primitive key={k} object={b.pivot} />
      ))}
    </>
  );
}

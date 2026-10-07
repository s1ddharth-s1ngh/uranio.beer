import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MODEL_URL } from "../config/bottle.ts";
import { CAROUSEL } from "../config/beers.ts";
import { sharedCarousel, slotPose, type CarouselState } from "../core/Carousel.ts";
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
 * Le laterali non usano nessuna maschera: niente cima accesa, niente fascia,
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

/**
 * Mette ogni bottiglia al suo posto sull'anello.
 *
 * Funzione di modulo e non corpo del `useFrame`: così il componente non
 * scrive dentro valori che gli arrivano dal render (regola
 * `react-hooks/immutability`), e la posa di uno slot si può leggere tutta
 * insieme senza React in mezzo.
 */
function disponi(
  bottiglie: readonly PreparedBottle[],
  s: SceneState,
  t: number,
  carousel: CarouselState,
) {
  const { escape, sideDim } = s.carousel;
  const { life } = CAROUSEL;

  for (let k = 0; k < bottiglie.length; k++) {
    const b = bottiglie[k];
    // niente da calcolare quando sono fuori scena: dallo step 1 in poi è il
    // 90% delle bottiglie della pagina
    b.pivot.visible = escape < 1;
    if (!b.pivot.visible) continue;

    const slot = k + 1;
    const pose = slotPose(slot, carousel.active, carousel.rot, carousel.count);
    // le laterali scappano verso l'esterno, ognuna dalla parte in cui già sta:
    // chi è a sinistra esce a sinistra (spec 7.4)
    const verso = Math.sign(pose.x) || 1;
    b.pivot.position.set(
      s.pivot.x + pose.x + verso * CAROUSEL.escapeX * escape,
      s.pivot.y + pose.y + Math.sin(t * life.ySpeed + slot * 1.7) * life.yAmp,
      s.pivot.z + pose.z - CAROUSEL.escapeZ * escape,
    );
    b.pivot.rotation.set(
      pose.rotX,
      pose.rotY,
      pose.rotZ + Math.sin(t * life.zSpeed + slot) * life.zAmp,
    );
    applyMasks(b.uniforms, SPENTE, sideDim);
  }
}

/**
 * Il carosello dell'hero (spec 6.6): le bottiglie **oltre** la protagonista.
 *
 * Lo slot 0 è la protagonista e la disegna `Bottle.tsx`: è la stessa bottiglia
 * che poi vive tutta l'esperienza, e duplicarla qui vorrebbe dire due
 * bottiglie da tenere in sincrono nel punto esatto in cui si guarda.
 *
 * Le posizioni sono **relative al pivot della protagonista**: così la
 * composizione dell'hero regge su ogni formato senza un secondo insieme di
 * ancore, perché la protagonista la posiziona già `solvePivot`.
 */
export function Carousel() {
  const { scene } = useGLTF(MODEL_URL, false);
  const gl = useThree((s) => s.gl);
  const vp = useViewport();
  const count = vp.mobile ? CAROUSEL.countMobile : CAROUSEL.count;
  const carousel = sharedCarousel(count);

  const bottiglie = useMemo(() => {
    // La prima copia è una preparazione vera (è lei a possedere geometrie e
    // texture condivise), le altre sono cloni che ne riusano le geometrie e si
    // tengono solo materiali e uniform propri.
    const base = prepareBottle(scene, {
      lowEnd: vp.mobile,
      maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
    });
    return [
      base,
      ...Array.from({ length: Math.max(0, count - 2) }, () => cloneBottle(base)),
    ];
  }, [scene, vp.mobile, gl, count]);

  useEffect(() => {
    // l'ordine conta: i cloni liberano i materiali, la base anche le
    // geometrie, e liberare le geometrie mentre un clone le usa ancora
    // lascerebbe un buffer morto agganciato
    const copie = bottiglie;
    return () => {
      for (let i = copie.length - 1; i >= 0; i--) copie[i].dispose();
    };
  }, [bottiglie]);

  useEffect(() => carousel.setCount(count), [carousel, count]);

  const mapper = sharedMapper(sharedViewport().state);
  useFrame(({ clock }) =>
    disponi(bottiglie, mapper.state, clock.elapsedTime, carousel),
  );

  return (
    <>
      {bottiglie.map((b, k) => (
        <primitive key={k} object={b.pivot} />
      ))}
    </>
  );
}

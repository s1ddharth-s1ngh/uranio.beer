import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HalfFloatType } from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import { POSTFX } from "../config/postfx.ts";
import { useViewport } from "../hooks/useViewport";

/**
 * Bloom selettivo, vignetta e grana (spec 6.9).
 *
 * Un `EffectPass` solo per tutti e tre: `postprocessing` di pmndrs fonde gli
 * effetti compatibili in un unico shader, quindi tre effetti costano un
 * passaggio e non tre.
 *
 * L'antialias è un FXAA in un passaggio suo, prima degli effetti: è un
 * effetto di convoluzione e non si fonde col bloom, e venendo prima non
 * sbava la grana. Non `antialias: true` sul contesto (vedi `Stage.tsx`) né
 * l'MSAA del composer: su una GPU integrata costavano metà dei frame
 * (`config/postfx.ts`).
 *
 * I testi dell'interfaccia non sono toccati da nulla di tutto questo: vivono
 * in HTML, su strati sopra il canvas (spec 4.2).
 */
export default function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const vp = useViewport();
  const composer = useRef<EffectComposer | null>(null);

  // Il composer nasce e muore nello stesso effetto, non in un `useMemo` con
  // la pulizia a parte: con `StrictMode` React smonta e rimonta gli effetti
  // una volta in sviluppo, e il composer memorizzato veniva liberato e poi
  // riusato con le sue render target già cancellate. Il canvas restava
  // fermo sul primo frame per tutto `npm run dev` (visto il 2026-11-04).
  useEffect(() => {
    const c = new EffectComposer(gl, {
      multisampling: POSTFX.multisampling,
      // mezza precisione in virgola mobile: serve al bloom, che deve leggere
      // valori sopra 1 per sapere cosa brilla. Con 8 bit per canale il bordo
      // del tappo e il fondo bianco sarebbero già entrambi "1" e brillerebbe
      // anche quello che non deve.
      frameBufferType: HalfFloatType,
    });
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new EffectPass(camera, new FXAAEffect()));

    const effetti = [];
    // Su mobile niente bloom (spec 6.9): è l'effetto che costa più banda di
    // memoria, e su uno schermo piccolo l'alone si vede appena.
    if (!vp.mobile) {
      effetti.push(
        new BloomEffect({
          mipmapBlur: true,
          luminanceThreshold: POSTFX.bloom.threshold,
          luminanceSmoothing: POSTFX.bloom.smoothing,
          intensity: POSTFX.bloom.intensity,
        }),
      );
    }
    const vignette = new VignetteEffect({
      offset: POSTFX.vignette.offset,
      darkness: POSTFX.vignette.darkness,
    });
    const grana = new NoiseEffect({ premultiply: true });
    grana.blendMode.opacity.value = POSTFX.noise.opacity;
    effetti.push(vignette, grana);

    c.addPass(new EffectPass(camera, ...effetti));
    composer.current = c;
    return () => {
      composer.current = null;
      c.dispose();
    };
  }, [gl, scene, camera, vp.mobile]);

  // anche col DPR: le render target del composer si misurano sul drawing
  // buffer, e il DPR adattivo (task 8.27) lo cambia senza cambiare `size`.
  // Dichiarato dopo quello che crea il composer: gli effetti girano in
  // ordine, quindi qui il composer c'è già
  const dpr = useThree((s) => s.viewport.dpr);
  useEffect(() => {
    composer.current?.setSize(size.width, size.height);
  }, [gl, scene, camera, vp.mobile, size, dpr]);

  // `priority = 1`: con una priorità diversa da zero R3F smette di disegnare
  // da sé e lascia il rendering a noi. Gli aggiornamenti della scena
  // (bottiglia, carosello, luci) stanno a priorità 0 e girano prima. Senza
  // composer (un attimo, fra uno smontaggio e il rimontaggio) si disegna
  // direttamente, invece di lasciare il canvas vuoto
  useFrame((_, delta) => {
    if (composer.current) composer.current.render(delta);
    else gl.render(scene, camera);
  }, 1);

  return null;
}

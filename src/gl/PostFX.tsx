import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HalfFloatType } from "three";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
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
 * L'antialias lo fa il `multisampling` del composer, non `antialias: true` sul
 * contesto (vedi `Stage.tsx`): pagarlo due volte non migliorerebbe niente.
 * Per la stessa ragione non c'è SMAA, che la spec 4.1 elencava come
 * alternativa: con l'MSAA attivo sarebbe un passaggio in più per lo stesso
 * risultato.
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

  const composer = useMemo(() => {
    const c = new EffectComposer(gl, {
      multisampling: POSTFX.multisampling,
      // mezza precisione in virgola mobile: serve al bloom, che deve leggere
      // valori sopra 1 per sapere cosa brilla. Con 8 bit per canale il bordo
      // del tappo e il fondo bianco sarebbero già entrambi "1" e brillerebbe
      // anche quello che non deve.
      frameBufferType: HalfFloatType,
    });
    c.addPass(new RenderPass(scene, camera));

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
    return c;
  }, [gl, scene, camera, vp.mobile]);

  useEffect(() => () => composer.dispose(), [composer]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  // `priority = 1`: con una priorità diversa da zero R3F smette di disegnare
  // da sé e lascia il rendering a noi. Gli aggiornamenti della scena
  // (bottiglia, carosello, luci) stanno a priorità 0 e girano prima.
  useFrame((_, delta) => composer.render(delta), 1);

  return null;
}

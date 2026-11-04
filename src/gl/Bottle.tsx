import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BAND_ORDER, BANDS, MODEL_URL } from "../config/bottle.ts";
import { REST_LIFE } from "../config/keyframes.ts";
import { bottleDrop, bottleRise, bottleSpin, sharedIntro } from "../core/Intro.ts";
import { sharedProgress } from "../core/Progress.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { DEBUG_MODE, registerDebug } from "../debug/registry";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import {
  applyMasks,
  applyTuning,
  readTuning,
  TUNING_RANGE,
} from "./materials/patchBottle.ts";
import { prepareBottle } from "./prepareBottle.ts";

/** quanto resta accesa ogni fascia nel ciclo di `?debug=bands`, in secondi */
const BANDS_CYCLE_S = 1.6;

/** un'onda di periodo `periodo` secondi */
const onda = (t: number, periodo: number) => Math.sin((t * Math.PI * 2) / periodo);

/**
 * La bottiglia protagonista.
 *
 * Non ha stato suo: a ogni frame copia dallo `StateMapper` posizione,
 * rotazione e maschere calcolate da `p`. Il `useFrame` gira dentro
 * l'`advance()` del nostro ticker (vedi `Stage.tsx`), quindi lo stato che
 * legge è già quello di questo frame, non del precedente.
 */
export function Bottle() {
  // `false` disattiva Draco: il GLB è compresso meshopt (che drei aggancia da
  // sé) e il decoder Draco punta a gstatic — una richiesta di rete per un
  // decoder che a questo file non serve.
  const { scene } = useGLTF(MODEL_URL, false);
  const gl = useThree((s) => s.gl);
  const vp = useViewport();
  const pivot = useRef<THREE.Group>(null);

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

  // Le manopole degli shader nel pannello (spec 8.5): sono i valori che si
  // regolano guardando, non calcolando — quanto è sfumato il bordo di una
  // fascia, quanto resta acceso il resto della bottiglia.
  useEffect(() => {
    const knobs = readTuning(prepared.uniforms);
    return registerDebug({
      title: "shader bottiglia",
      target: knobs,
      knobs: TUNING_RANGE,
      onChange: () => applyTuning(prepared.uniforms, knobs),
    });
  }, [prepared]);

  const mapper = sharedMapper(sharedViewport().state);
  const progress = sharedProgress();
  const intro = sharedIntro();
  const reduced = usePrefersReducedMotion();
  // il peso della vita a riposo: parte pieno, la pagina si apre ferma
  const quiete = useRef(1);
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
    if (!reduced && q > 1e-4) {
      const t = clock.elapsedTime;
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
    g.position.y += bottleDrop(intro.value);
    g.rotation.y -= bottleSpin(intro.value);
    applyMasks(prepared.uniforms, s.uniforms, bottleRise(intro.value));

    if (DEBUG_MODE === "bands") {
      // `?debug=bands`: la fascia accesa gira sulle quattro, ferma su ognuna,
      // per controllare che ciascuna accenda esattamente il suo blocco di
      // testo. La bottiglia resta dove la mette `p`: si va sullo step 2 con la
      // rotella e si guarda.
      const i =
        Math.floor(clock.elapsedTime / BANDS_CYCLE_S) % BAND_ORDER.length;
      const fascia = BANDS[BAND_ORDER[i]];
      applyMasks(prepared.uniforms, {
        ...s.uniforms,
        reveal: 0,
        focus: 1,
        focusY: fascia.y,
        focusHalf: fascia.half,
      });
    }
  });

  return <primitive ref={pivot} object={prepared.pivot} />;
}

// Il GLB parte a scaricare appena questo modulo arriva, non quando il
// componente monta: sono 320 KB e il preloader (task 8.22) ne mostra il
// progresso reale.
useGLTF.preload(MODEL_URL, false);

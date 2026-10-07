import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BAND_ORDER, BANDS, MODEL_URL } from "../config/bottle.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { DEBUG_MODE, registerDebug } from "../debug/registry";
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
  useFrame(({ clock }) => {
    const g = pivot.current;
    if (!g) return;
    const s = mapper.state;
    g.position.copy(s.pivot);
    g.rotation.copy(s.rotation);

    applyMasks(prepared.uniforms, s.uniforms);

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

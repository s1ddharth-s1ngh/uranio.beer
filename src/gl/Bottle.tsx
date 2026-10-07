import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MODEL_URL } from "../config/bottle.ts";
import { sharedMapper } from "../core/StateMapper.ts";
import { sharedViewport, useViewport } from "../hooks/useViewport";
import { prepareBottle } from "./prepareBottle.ts";

/**
 * La bottiglia protagonista.
 *
 * Non ha stato suo: a ogni frame copia dallo `StateMapper` la posizione e la
 * rotazione calcolate da `p`. Il `useFrame` gira dentro l'`advance()` del
 * nostro ticker (vedi `Stage.tsx`), quindi lo stato che legge è già quello di
 * questo frame, non del precedente.
 */
export function Bottle() {
  // `false` disattiva Draco: il GLB è compresso meshopt (che drei aggancia da
  // sé) e il decoder Draco punta a gstatic — una richiesta di rete per un
  // decoder che non serve a questo file.
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

  const mapper = sharedMapper(sharedViewport().state);
  useFrame(() => {
    const g = pivot.current;
    if (!g) return;
    const s = mapper.state;
    g.position.copy(s.pivot);
    g.rotation.copy(s.rotation);
  });

  return <primitive ref={pivot} object={prepared.pivot} />;
}

// Il GLB parte a scaricare appena questo modulo arriva, non quando il
// componente monta: sono 320 KB e il preloader (task 8.22) ne mostra il
// progresso reale.
useGLTF.preload(MODEL_URL, false);

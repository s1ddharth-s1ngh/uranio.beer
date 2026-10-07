import { Environment, Lightformer } from "@react-three/drei";
import { ENV } from "../config/lights.ts";

/**
 * L'ambiente riflesso (spec 6.4): un softbox sopra, due strisce verticali ai
 * lati, un rimbalzo caldo dal basso. `frames={1}` la rende una volta sola —
 * i piani non si muovono, e rigenerare la PMREM a ogni frame costerebbe più
 * di tutta la scena.
 */
export function LightRig() {
  const { top, sides, bottom } = ENV;
  return (
    <Environment resolution={ENV.resolution} frames={1}>
      <Lightformer
        form="rect"
        intensity={top.intensity}
        color={top.color}
        scale={[...top.scale]}
        position={[...top.position]}
        rotation-x={Math.PI / 2}
      />
      {/* le strisce guardano la bottiglia di fianco: è il loro riflesso
          allungato che fa leggere il vetro come vetro */}
      {[-1, 1].map((segno) => (
        <Lightformer
          key={segno}
          form="rect"
          intensity={sides.intensity}
          color={sides.color}
          scale={[...sides.scale]}
          position={[segno * sides.x, sides.y, sides.z]}
          rotation-y={(segno * Math.PI) / 2}
        />
      ))}
      <Lightformer
        form="rect"
        intensity={bottom.intensity}
        color={bottom.color}
        scale={[...bottom.scale]}
        position={[...bottom.position]}
        rotation-x={-Math.PI / 2}
      />
    </Environment>
  );
}

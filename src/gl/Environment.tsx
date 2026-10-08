import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ENV } from "../config/lights.ts";

type Piano = {
  scale: readonly number[];
  position: readonly number[];
  rotation: readonly [number, number, number];
  intensity: number;
  color: string;
};

/**
 * Un "lightformer": un piano emissivo. Colore × intensità e niente tone
 * mapping, come il `Lightformer` di drei che sostituisce.
 */
function piano(geo: THREE.PlaneGeometry, p: Piano): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(p.color).multiplyScalar(p.intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
  mesh.position.set(p.position[0], p.position[1], p.position[2]);
  mesh.rotation.set(...p.rotation);
  return mesh;
}

/**
 * Costruisce la PMREM e la mette sulla scena; restituisce la pulizia.
 *
 * Funzione di modulo e non corpo dell'effetto: `scene` arriva da un hook, e
 * la regola `react-hooks/immutability` vieta di scriverci dal componente.
 */
function accendi(gl: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
  const { top, sides, bottom } = ENV;
  const geo = new THREE.PlaneGeometry(1, 1);
  const env = new THREE.Scene();
  env.add(piano(geo, { ...top, rotation: [Math.PI / 2, 0, 0] }));
  // le strisce guardano la bottiglia di fianco: è il loro riflesso allungato
  // che fa leggere il vetro come vetro
  for (const segno of [-1, 1]) {
    env.add(
      piano(geo, {
        ...sides,
        position: [segno * sides.x, sides.y, sides.z],
        rotation: [0, (segno * Math.PI) / 2, 0],
      }),
    );
  }
  env.add(piano(geo, { ...bottom, rotation: [-Math.PI / 2, 0, 0] }));

  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0, 0.1, 100, { size: ENV.resolution });
  pmrem.dispose();
  geo.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
  });
  scene.environment = rt.texture;
  return () => {
    scene.environment = null;
    rt.dispose();
  };
}

/**
 * L'ambiente riflesso (spec 6.4): un softbox sopra, due strisce verticali ai
 * lati, un rimbalzo caldo dal basso, passati una volta sola a
 * `PMREMGenerator.fromScene` — i piani non si muovono, rigenerarla a ogni
 * frame costerebbe più di tutta la scena.
 *
 * Fatta a mano e non con `<Environment>` di drei (task 8.27): quello porta
 * nel JavaScript del primo frame i loader EXR, RGBE e gainmap per HDR che qui
 * non si scaricano mai.
 */
export function LightRig() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => accendi(gl, scene), [gl, scene]);
  return null;
}

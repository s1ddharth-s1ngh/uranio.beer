import * as THREE from "three";

/**
 * Un punto dello schermo (0–1 dall'alto a sinistra, come nel CSS) a `depth`
 * dalla camera, in coordinate mondo. La camera deve avere la matrice mondo
 * aggiornata: nel `useFrame` è ancora quella del frame prima, finché non la
 * aggiorna il render.
 */
export function screenPoint(
  camera: THREE.Camera,
  [sx, sy]: readonly [number, number],
  depth: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(sx * 2 - 1, 1 - sy * 2, 0.5).unproject(camera).sub(camera.position).normalize();
  return out.multiplyScalar(depth).add(camera.position);
}

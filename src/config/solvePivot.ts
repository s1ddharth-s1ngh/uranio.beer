// Dove mettere la bottiglia, senza scriverlo a mano (spec 7.1).
//
// Scrivere la posizione del pivot per ogni step a mano significa rifarla a
// ogni formato: a 21:9 la bottiglia esce dal frame, a 4:3 copre il testo. Qui
// si dichiara invece **quale punto della bottiglia** deve finire **in quale
// punto dello schermo**, e la posizione del pivot si ricava. I keyframe mobile
// sono solo ancore diverse.

import * as THREE from "three";

/** Un punto della bottiglia (y locale al pivot) su un punto dello schermo. */
export interface Anchor {
  /** y in coordinate locali del pivot: da −centerY (fondo) a +centerY (cima) */
  localY: number;
  /** 0–1, origine in alto a sinistra come nel CSS */
  screen: readonly [number, number];
}

export interface CameraSpec {
  position: readonly [number, number, number];
  look: readonly [number, number, number];
}

/** Camera da still life: tele, poca distorsione (spec 6.1). */
export const CAMERA = { fov: 28, near: 0.1, far: 100 } as const;

// Niente allocazioni: questi oggetti si riusano a ogni chiamata (regola 8.27).
const offset = new THREE.Vector3();
const ndc = new THREE.Vector3();
const dir = new THREE.Vector3();

/** Porta la camera di scorta sui valori di un keyframe. */
export function configureCamera(
  cam: THREE.PerspectiveCamera,
  spec: CameraSpec,
  aspect: number,
): THREE.PerspectiveCamera {
  cam.fov = CAMERA.fov;
  cam.near = CAMERA.near;
  cam.far = CAMERA.far;
  cam.aspect = aspect;
  cam.position.set(...(spec.position as [number, number, number]));
  cam.updateProjectionMatrix();
  cam.lookAt(...(spec.look as [number, number, number]));
  cam.updateMatrixWorld(true);
  return cam;
}

/**
 * Posizione del pivot che porta l'ancora dove deve stare.
 *
 * Il punto si risolve sul piano `z = offset.z`, cioè sul piano verticale che
 * passa per l'ancora quando il pivot è sull'asse z = 0: tutti i keyframe
 * tengono il pivot a z = 0, e così la soluzione è esatta e non iterativa.
 */
export function solvePivot(
  cam: THREE.PerspectiveCamera,
  rotation: THREE.Euler,
  anchor: Anchor,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  offset.set(0, anchor.localY, 0).applyEuler(rotation);
  ndc
    .set(anchor.screen[0] * 2 - 1, -(anchor.screen[1] * 2 - 1), 0.5)
    .unproject(cam);
  dir.copy(ndc).sub(cam.position).normalize();
  // Con la camera che guarda lungo −z `dir.z` è ben lontano da zero. Il guardo
  // serve solo a non propagare un NaN se un giorno un keyframe mettesse la
  // camera di fianco: in quel caso il piano giusto non è più z = costante.
  const dz = Math.abs(dir.z) < 1e-6 ? (dir.z < 0 ? -1e-6 : 1e-6) : dir.z;
  const t = (offset.z - cam.position.z) / dz;
  return out.copy(cam.position).addScaledVector(dir, t).sub(offset);
}

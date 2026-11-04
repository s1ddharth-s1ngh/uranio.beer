// Dove cadono sullo schermo la protagonista e il piedistallo nell'hero
// (task 8.19).
//
// L'interfaccia dell'hero (nome, frecce) si appoggia alla scena 3D. Scrivere
// le sue posizioni come percentuali nel CSS vorrebbe dire rifarle a ogni
// ritocco delle ancore (task 8.28): qui si proietta la scena vera allo step 0,
// e il CSS riceve il risultato.

import * as THREE from "three";
import { PROPS } from "../config/props.ts";
import { configureCamera } from "../config/solvePivot.ts";
import { StateMapper } from "./StateMapper.ts";
import type { ViewportState } from "./Viewport.ts";

export interface HeroLayout {
  /** il pivot della protagonista, frazione 0–1 dall'alto */
  centerY: number;
  /** il bordo alto anteriore del piedistallo, frazione 0–1 dall'alto */
  pedestalTopY: number;
}

const toScreenY = (v: THREE.Vector3, cam: THREE.Camera) =>
  (1 - v.project(cam).y) / 2;

/**
 * Funzione pura del viewport. Un `StateMapper` **nuovo** e non
 * `sharedMapper()`: lo stato di quello è il frame in corso, che durante una
 * transizione non è l'hero. Si chiama solo al resize, quindi le allocazioni
 * non pesano.
 *
 * Con il FOV verticale fisso le y non dipendono dalla larghezza: cambiano solo
 * fra keyframe desktop e mobile.
 */
export function heroLayout(vp: ViewportState): HeroLayout {
  const s = new StateMapper(vp).apply(0);
  const cam = configureCamera(
    new THREE.PerspectiveCamera(),
    {
      position: s.camera.position.toArray(),
      look: s.camera.look.toArray(),
    },
    vp.aspect,
  );
  const { base } = PROPS;
  // il cilindro del piedistallo è centrato sull'origine del suo gruppo, che
  // sta a `pivot + base.y` (gl/HeroProps.tsx): il bordo alto anteriore è mezza
  // altezza sopra, un raggio verso la camera
  const bordo = new THREE.Vector3(0, base.y + base.height / 2, base.radius).add(s.pivot);
  return {
    centerY: toScreenY(s.pivot.clone(), cam),
    pedestalTopY: toScreenY(bordo, cam),
  };
}

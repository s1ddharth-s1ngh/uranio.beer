// Dove cade sullo schermo il piedistallo dell'anello (task 8.19, ripreso il
// 2026-11-04).
//
// Il nome dell'hero si appoggia al piedistallo 3D. Scrivere la sua posizione
// come percentuale nel CSS vorrebbe dire rifarla a ogni ritocco delle ancore:
// qui si proietta la scena vera allo step 0, e il CSS riceve il risultato.

import * as THREE from "three";
import { PROPS } from "../config/props.ts";
import { configureCamera } from "../config/solvePivot.ts";
import { StateMapper } from "./StateMapper.ts";
import type { ViewportState } from "./Viewport.ts";

export interface HeroLayout {
  /** il bordo alto anteriore del piedistallo, frazione 0–1 dall'alto */
  pedestalTopY: number;
}

/**
 * Funzione pura del viewport. Un `StateMapper` **nuovo** e non
 * `sharedMapper()`: lo stato di quello è il frame in corso, che durante una
 * transizione non è l'hero. Si chiama solo al resize, quindi le allocazioni
 * non pesano.
 */
export function heroLayout(vp: ViewportState): HeroLayout {
  const s = new StateMapper(vp).apply(0);
  const cam = configureCamera(
    new THREE.PerspectiveCamera(),
    { position: s.camera.position.toArray(), look: s.camera.look.toArray() },
    vp.aspect,
  );
  const { base } = PROPS;
  // il cilindro è centrato sull'origine del suo gruppo, che sta a
  // `pivot + base.y` (gl/HeroProps.tsx): il bordo alto anteriore è mezza
  // altezza sopra, un raggio verso la camera
  const bordo = new THREE.Vector3(0, base.y + base.height / 2, base.radius).add(s.pivot);
  return { pedestalTopY: (1 - bordo.project(cam).y) / 2 };
}

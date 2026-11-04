// Store minimale e senza dipendenze per il progresso di caricamento degli
// asset 3D. Il Loader (bundle principale) legge da qui; è la scena (chunk
// lazy, dove vivono three/drei) a scrivere. Così three non finisce nel
// bundle principale solo per mostrare una percentuale.

export interface AssetProgress {
  progress: number; // 0..100
  active: boolean; // c'è un caricamento in corso
  // false finché il chunk della scena non ha ancora scritto nulla: distingue
  // "nessun dato" (chunk in download) da "tutto caricato"
  reported: boolean;
}

let state: AssetProgress = { progress: 0, active: false, reported: false };

/**
 * La scena è montata, l'ambiente generato e gli shader compilati: il primo
 * frame visibile sarà già composto (task 8.22). Il GLB scaricato non basta —
 * dopo il download restano la Suspense da risolvere, la PMREM e la
 * compilazione dei programmi, e senza aspettarle si vedrebbero cadere sul
 * primo frame scoperto.
 */
let sceneReady = false;

export function setAssetProgress(
  next: Omit<AssetProgress, "reported">,
): void {
  state = { ...next, reported: true };
}

export function setSceneReady(): void {
  sceneReady = true;
}

export function isSceneReady(): boolean {
  return sceneReady;
}

export function getAssetProgress(): AssetProgress {
  return state;
}

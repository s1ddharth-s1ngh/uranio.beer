// L'illuminazione, in numeri (spec 6.4).
//
// Il look da ottenere è quello di uno still life: vetro scuro quasi nero che
// vive di **riflessi lunghi**, non di luci puntiformi. Per questo l'ambiente
// conta più dei fari: due strisce verticali alte e strette a sinistra e a
// destra sono ciò che disegna le due lame di riflesso sul cilindro, e nessuna
// `PointLight` le può imitare.
//
// Sono valori di partenza: si regolano da `?debug` e si ricopiano qui.

import { COLORS } from "./theme.ts";

/**
 * L'env map fatta in casa: una scenetta di piani emissivi resa una volta in
 * una cubemap. Niente HDR da scaricare — sono megabyte per un riflesso che a
 * 256 px nessuno distingue.
 */
export const ENV = {
  resolution: 256,
  /** softbox grande sopra la bottiglia */
  top: { scale: [12, 12, 1], position: [0, 7, 0], intensity: 1.1, color: COLORS.white },
  /** le due strisce verticali: i riflessi lunghi sul vetro */
  sides: {
    scale: [0.7, 9, 1],
    x: 5,
    y: 1,
    z: 1.5,
    intensity: 2.2,
    color: COLORS.white,
  },
  /** rimbalzo caldo e debole dal basso, perché i neri non siano morti */
  bottom: {
    scale: [10, 6, 1],
    position: [0, -5, 2],
    intensity: 0.35,
    color: COLORS.redMid,
  },
} as const;

/**
 * Lo spot sul tappo (spec 6.4). Sta sopra e un filo davanti alla cima della
 * bottiglia protagonista e la segue: nel primo piano è il punto più luminoso
 * dello schermo, negli step del retro è quasi spento. L'intensità la guida
 * `p` (`SceneState.spot`), qui c'è solo la forma del fascio.
 *
 * `decay: 0` di proposito. Con il decadimento fisico l'intensità di uno spot è
 * in candele e cala col quadrato della distanza: i valori dei keyframe (0,8 /
 * 3,0 / 0,2) diventerebbero numeri senza senso da ritarare a ogni
 * spostamento di camera. Spento il decadimento, il keyframe dice "quanto
 * forte" e basta — e `gain` porta quella scala in watt three.
 */
export const SPOT = {
  /** quanto sopra e quanto davanti alla cima, in unità del modello */
  offset: [0, 2.6, 1.4],
  angle: 0.22,
  penumbra: 0.9,
  decay: 0,
  /** moltiplicatore fra il valore del keyframe e l'intensità di three */
  gain: 10,
  color: COLORS.white,
} as const;

/**
 * Rim light: due direzionali da dietro, a sinistra e a destra. Tengono
 * leggibile la silhouette anche quando il corpo della bottiglia è spento —
 * negli step del retro sono loro a disegnare il profilo del vetro.
 */
export const RIM = {
  intensity: 1.2,
  color: COLORS.redMid,
  /** direzione da cui arrivano, specchiata sull'asse x */
  position: [4.5, 1.5, -5],
} as const;

/** Riempimento debolissimo: serve solo a non avere neri morti. */
export const FILL = { intensity: 0.15, sky: COLORS.white, ground: COLORS.redDeep } as const;

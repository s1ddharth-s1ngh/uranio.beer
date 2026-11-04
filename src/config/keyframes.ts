// Lo stato 3D di ogni step, e quando ogni cosa si muove dentro una
// transizione (spec 7.2, 7.3, 7.4).
//
// Questo file è dichiarativo di proposito: nessuna logica, solo numeri con un
// nome. Chi interpola è `core/StateMapper.ts`. I valori si regolano dal vivo
// con `?debug` e si ricopiano qui col pulsante "copia keyframe" (regola
// 10.1.6): le ancore e le finestre sono la cosa che più probabilmente va
// ritoccata guardando gli screenshot del task 8.28.

import { BANDS, BOTTLE, SHADER } from "./bottle.ts";
import type { Anchor, CameraSpec } from "./solvePivot.ts";

export type Vec3 = readonly [number, number, number];

export interface Keyframe {
  camera: CameraSpec;
  /** rotazione del pivot in radianti, interpolata come numeri (vedi sotto) */
  rotation: Vec3;
  anchor: Anchor;
  /** intensità dello spot sul tappo */
  spot: number;
  /** maschera "solo la cima accesa" */
  reveal: number;
  revealY: number;
  /** maschera "solo la fascia accesa" */
  focus: number;
  focusY: number;
  focusHalf: number;
  /** pesi dello sfondo: hero, step, finale */
  background: Vec3;
  /** luminosità delle altre bottiglie della gamma */
  sideDim: number;
  /** 0 = le altre bottiglie in fila, 1 = fuori dal frame ai lati */
  escape: number;
}

/** una fascia dell'etichetta in coordinate locali del pivot */
const fasciaLocale = (y: number) => y - BOTTLE.centerY;

/**
 * Keyframe desktop, composti su 1440×900 (spec 7.2, rivista il 2026-11-04 sul
 * riferimento ciaoenergy.com): la bottiglia arriva sola e inclinata, gira sul
 * retro fascia per fascia, poi la raggiungono tutte le altre in fila, poi il
 * finale. Niente carosello ad anello né faro: erano lo step più pesante.
 */
export const KEYFRAMES: readonly Keyframe[] = [
  // 0 · Hero: sola, grande, inclinata con la cima a sinistra, il fronte in
  // camera; il titolo sta a sinistra (HeroUi)
  {
    camera: { position: [0, 0, 10.5], look: [0, 0, 0] },
    rotation: [0.16, 0, 0.44],
    // abbastanza in basso perché il tappo non tocchi il logo dell'header
    anchor: { localY: 0, screen: [0.58, 0.54] },
    spot: 1.2,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 0,
    focusY: BANDS.f1.y,
    focusHalf: BANDS.f1.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
  },
  // 1–4 · il retro, una fascia per step: la bottiglia sale e si raddrizza
  {
    camera: { position: [0, 0, 7], look: [0, 0, 0] },
    rotation: [0.12, Math.PI, 0.26],
    anchor: { localY: fasciaLocale(BANDS.f1.y), screen: [0.6, 0.42] },
    spot: 0.2,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 1,
    focusY: BANDS.f1.y,
    focusHalf: BANDS.f1.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
  },
  {
    camera: { position: [0, 0, 7], look: [0, 0, 0] },
    rotation: [0.12, Math.PI, 0.19],
    anchor: { localY: fasciaLocale(BANDS.f2.y), screen: [0.6, 0.42] },
    spot: 0.2,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 1,
    focusY: BANDS.f2.y,
    focusHalf: BANDS.f2.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
  },
  {
    camera: { position: [0, 0, 7], look: [0, 0, 0] },
    rotation: [0.1, Math.PI, 0.14],
    anchor: { localY: fasciaLocale(BANDS.f3.y), screen: [0.6, 0.45] },
    spot: 0.2,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 1,
    focusY: BANDS.f3.y,
    focusHalf: BANDS.f3.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
  },
  {
    camera: { position: [0, 0, 7], look: [0, 0, 0] },
    rotation: [0.08, Math.PI, 0.1],
    anchor: { localY: fasciaLocale(BANDS.f4.y), screen: [0.6, 0.45] },
    spot: 0.2,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 1,
    focusY: BANDS.f4.y,
    focusHalf: BANDS.f4.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
  },
  // 5 · La gamma: finito il giro (2π, di nuovo il fronte) arrivano le altre
  // dai lati e si mettono in fila curva, la protagonista al centro. Sfondo da
  // studio, pavimento chiaro: è la schermata più luminosa
  {
    camera: { position: [0, 0, 16], look: [0, 0, 0] },
    rotation: [0, Math.PI * 2, 0.08],
    anchor: { localY: 0, screen: [0.5, 0.46] },
    spot: 0.6,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 0,
    focusY: BANDS.f4.y,
    focusHalf: BANDS.f4.half,
    background: [1, 0, 0],
    sideDim: 0.9,
    escape: 0,
  },
  // 6 · Finale: le altre riescono, lei resta intera nel frame, nebbia
  {
    camera: { position: [0, 0, 15], look: [0, 0, 0] },
    rotation: [0.06, Math.PI * 2, -0.06],
    anchor: { localY: 0, screen: [0.5, 0.52] },
    spot: 1,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 0,
    focusY: BANDS.f4.y,
    focusHalf: BANDS.f4.half,
    background: [0, 0, 1],
    sideDim: 0,
    escape: 1,
  },
];

/**
 * Mobile verticale, base 390×844 (spec 7.3): camera più lontana (la bottiglia
 * deve stare sopra il testo, che occupa il 60–92% dell'altezza) e ancore più
 * alte. Cambiano **solo** quelle due cose: tutto il resto è lo stesso stato,
 * e tenerlo scritto una volta sola è il motivo per cui le ancore esistono.
 */
const MOBILE_CAM_Z = [17, 9.5, 9.5, 9.5, 9.5, 26, 19] as const;
const MOBILE_SCREEN: readonly Vec3[] = [
  [0.5, 0.32, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
  [0.5, 0.46, 0],
  [0.5, 0.42, 0],
];

export const KEYFRAMES_MOBILE: readonly Keyframe[] = KEYFRAMES.map((k, i) => ({
  ...k,
  camera: {
    position: [k.camera.position[0], k.camera.position[1], MOBILE_CAM_Z[i]],
    look: k.camera.look,
  },
  anchor: {
    localY: k.anchor.localY,
    screen: [MOBILE_SCREEN[i][0], MOBILE_SCREEN[i][1]],
  },
}));

/**
 * Tablet verticale (spec 8.23): la composizione del telefono, con la camera
 * allontanata di questo fattore. Le ancore sono frazioni dello schermo, quindi
 * restano dove sono: cambia solo quanto è grande la bottiglia, che su uno
 * schermo più tozzo di 390×844 a parità di camera riempirebbe troppo.
 */
export const TABLET_CAM_SCALE = 1.1;

export const KEYFRAMES_TABLET: readonly Keyframe[] = KEYFRAMES_MOBILE.map((k) => ({
  ...k,
  camera: {
    position: [
      k.camera.position[0],
      k.camera.position[1],
      k.camera.position[2] * TABLET_CAM_SCALE,
    ],
    look: k.camera.look,
  },
}));

/**
 * I gruppi di proprietà che possono partire in momenti diversi dentro una
 * transizione. Lo sfalsamento è ciò che distingue una regia da un'interpolazione
 * lineare: le laterali scappano subito, la camera arriva dopo, la luce per
 * ultima.
 */
export type Group =
  | "lati"
  | "sfondo"
  | "camera"
  | "rotazione"
  | "reveal"
  | "focus"
  | "sweep";

export type Window = readonly [number, number];
export const FULL_WINDOW: Window = [0, 1];

export interface Segment {
  windows: Partial<Record<Group, Window>>;
  /** ampiezza della lama di luce in questo segmento */
  sweepAmt: number;
}

/** Una voce per segmento: `p` da k a k+1 (spec 7.4). */
export const SEGMENTS: readonly Segment[] = [
  // 0 → 1 · hero → F1: la rotazione di 180° è il movimento principale, la
  // luce si stringe sulla prima fascia quando il retro è già in camera
  {
    windows: {
      rotazione: [0, 0.85],
      camera: [0.1, 1],
      focus: [0.45, 1],
      sweep: [0.15, 0.75],
    },
    sweepAmt: 1,
  },
  // 1 ↔ 2 ↔ 3 ↔ 4 · la fascia accesa scivola sul paragrafo nuovo
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  // 4 → 5 · F4 → gamma: lei finisce il giro e si allontana, le altre entrano
  // dai lati quando la camera ha già fatto spazio
  {
    windows: {
      focus: [0, 0.35],
      rotazione: [0.05, 0.8],
      camera: [0.05, 0.85],
      lati: [0.3, 1],
      sfondo: [0.2, 0.8],
      sweep: [0.1, 0.6],
    },
    sweepAmt: 0.6,
  },
  // 5 → 6 · gamma → finale: le altre scappano per prime, poi arriva la nebbia
  {
    windows: {
      lati: [0, 0.55],
      camera: [0.2, 1],
      // ferma nell'ultimo tratto: al ritorno la scritta esce prima che riparta
      rotazione: [0.2, 0.85],
      sfondo: [0.25, 0.85],
    },
    sweepAmt: 0,
  },
];

/**
 * La vita a riposo della protagonista (spec 7.4): sommata sopra lo stato di
 * `p` da `gl/Bottle.tsx`, smorzata a zero mentre `p` si muove. Ampiezze in
 * unità di scena e radianti, periodi in secondi.
 */
export const REST_LIFE = {
  /**
   * Costante di tempo del peso "quiete": quanto ci mette la vita a spegnersi
   * quando parte una transizione e a riaccendersi quando finisce. Senza, il
   * primo frame del movimento scatterebbe di tutta l'ampiezza.
   */
  tau: 0.6,
  /** sempre: fluttuazione in altezza e un filo di dondolio */
  y: { amp: 0.03, period: 5 },
  z: { amp: 0.01, period: 7 },
  /** nel finale, oscillazione lenta che mostra fronte e fianchi */
  finaleSpin: { amp: 0.12, period: 8 },
} as const;

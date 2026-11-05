// Lo stato 3D di ogni step, e quando ogni cosa si muove dentro una
// transizione (spec 7.2, 7.3, 7.4).
//
// Questo file è dichiarativo di proposito: nessuna logica, solo numeri con un
// nome. Chi interpola è `core/StateMapper.ts`. I valori si regolano dal vivo
// con `?debug` e si ricopiano qui col pulsante "copia keyframe" (regola
// 10.1.6): le ancore e le finestre sono la cosa che più probabilmente va
// ritoccata guardando gli screenshot.

import { BANDS, BOTTLE, LABEL_CENTER_LOCAL, SHADER } from "./bottle.ts";
import type { Anchor, CameraSpec } from "./solvePivot.ts";

export type Vec3 = readonly [number, number, number];

export interface Keyframe {
  camera: CameraSpec;
  /** rotazione del pivot in radianti, interpolata come numeri (vedi sotto) */
  rotation: Vec3;
  anchor: Anchor;
  /** intensità dello spot sul tappo */
  spot: number;
  /** intensità della luce sulla faccia, da destra in alto (`gl/Lights.tsx`) */
  face: number;
  /** maschera "solo la cima accesa" */
  reveal: number;
  revealY: number;
  /** maschera "solo la fascia accesa" */
  focus: number;
  focusY: number;
  focusHalf: number;
  /** mezzo arco della fascia accesa, in radianti */
  focusAngleHalf: number;
  /** pesi dello sfondo: studio, alone degli step, nebbia */
  background: Vec3;
  /** luminosità delle altre bottiglie */
  sideDim: number;
  /** 0 = le altre bottiglie in scena, 1 = fuori dal frame ai lati */
  escape: number;
  /** 0 = le altre sull'anello dell'hero, 1 = in fila (la gamma) */
  layout: number;
  /** 0 = faro e piedistallo in scena, 1 = usciti (il faro in alto, il piedistallo in basso) */
  props: number;
  /** 0 = tappo chiuso sul collo, 1 = staccato e sospeso accanto alla bottiglia */
  cap: number;
  /** quanto la bottiglia guarda verso il cursore, 0–1 (`core/Pointer.ts`) */
  look: number;
}

/** una fascia dell'etichetta in coordinate locali del pivot */
const fasciaLocale = (y: number) => y - BOTTLE.centerY;

/** i canali delle fasce, uguali per tutti gli step che non ne accendono una */
const SPENTA = {
  reveal: 0,
  revealY: SHADER.revealY,
  focus: 0,
  focusY: BANDS.f1.y,
  focusHalf: BANDS.f1.half,
  focusAngleHalf: BANDS.f1.angleHalf,
} as const;

/** una fascia del retro accesa */
const accesa = (b: (typeof BANDS)[keyof typeof BANDS]) => ({
  reveal: 0,
  revealY: SHADER.revealY,
  focus: 1,
  focusY: b.y,
  focusHalf: b.half,
  focusAngleHalf: b.angleHalf,
});

/**
 * il retro: niente anello, niente faro, tappo sospeso, sfondo degli step. La
 * camera è vicina come nel riferimento, dove la lattina riempie il frame e il
 * blocco acceso è grande quanto il titolo accanto (confronto del 2026-11-04)
 */
const RETRO = {
  camera: { position: [0, 0, 6], look: [0, 0, 0] },
  spot: 0.25,
  face: 0,
  background: [0, 1, 0],
  sideDim: 0,
  escape: 1,
  layout: 1,
  props: 1,
  cap: 1,
  look: 0.45,
} as const;

/**
 * Keyframe desktop, composti su 1440×900, sul riferimento ciaoenergy.com
 * (rivisti il 2026-11-04 sulle schermate del proprietario):
 *
 * 0. tutte le bottiglie su un anello, la protagonista al centro fra faro e
 *    piedistallo, il nome sul piedistallo;
 * 1. lei sola, grande e inclinata, la faccia girata in alto a destra e la
 *    luce addosso, il nome a sinistra;
 * 2–5. gira sul retro (e il tappo salta via), una fascia accesa per step;
 * 6. il giro finisce, le altre tornano in fila, il tappo si richiude:
 *    "ZERO CRISI" e le call to action.
 */
export const KEYFRAMES: readonly Keyframe[] = [
  // 0 · Anello: camera lontana, la protagonista col fondo verso di noi e la
  // cima un filo a sinistra, come la lattina al centro del riferimento; la
  // faccia già un poco in alto a destra, verso il faro
  {
    camera: { position: [0, 0.4, 14.5], look: [0, 0.2, 0] },
    rotation: [-0.2, 0.22, 0.16],
    anchor: { localY: 0, screen: [0.5, 0.45] },
    spot: 1,
    face: 0.45,
    ...SPENTA,
    background: [1, 0, 0],
    sideDim: 0.34,
    escape: 0,
    layout: 0,
    props: 0,
    cap: 0,
    look: 1,
  },
  // 1 · Fronte: grande, inclinata con la cima a sinistra, la faccia che
  // guarda in alto a destra, verso il cielo e verso la luce (la richiesta del
  // proprietario sull'immagine 13 del riferimento); il fondo esce dal bordo
  // basso come la lattina del riferimento. `x` negativo alza la faccia: con
  // `x` positivo la cima veniva verso di noi e la faccia guardava in basso
  {
    camera: { position: [0, 0, 5.8], look: [0, 0, 0] },
    rotation: [-0.25, 0.5, 0.4],
    anchor: { localY: LABEL_CENTER_LOCAL, screen: [0.66, 0.64] },
    spot: 1.6,
    face: 1,
    ...SPENTA,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
    layout: 0,
    props: 1,
    cap: 0,
    look: 1,
  },
  // 2–5 · il retro, una fascia per step: la bottiglia sale e si raddrizza
  {
    ...RETRO,
    rotation: [0.12, Math.PI, 0.26],
    anchor: { localY: fasciaLocale(BANDS.f1.y), screen: [0.63, 0.44] },
    ...accesa(BANDS.f1),
  },
  {
    ...RETRO,
    rotation: [0.12, Math.PI, 0.19],
    anchor: { localY: fasciaLocale(BANDS.f2.y), screen: [0.63, 0.44] },
    ...accesa(BANDS.f2),
  },
  {
    ...RETRO,
    rotation: [0.1, Math.PI, 0.14],
    anchor: { localY: fasciaLocale(BANDS.f3.y), screen: [0.63, 0.46] },
    ...accesa(BANDS.f3),
  },
  {
    ...RETRO,
    rotation: [0.08, Math.PI, 0.1],
    anchor: { localY: fasciaLocale(BANDS.f4.y), screen: [0.63, 0.46] },
    ...accesa(BANDS.f4),
  },
  // 6 · La gamma e il finale: finito il giro (2π, di nuovo il fronte) le
  // altre arrivano dai lati in fila curva e il tappo torna sul collo. Sfondo
  // da studio, "ZERO CRISI" dietro, le call to action sotto
  {
    camera: { position: [0, 0, 13.5], look: [0, 0, 0] },
    rotation: [0, Math.PI * 2, 0.08],
    anchor: { localY: 0, screen: [0.5, 0.45] },
    spot: 0.8,
    face: 0.35,
    ...SPENTA,
    focusY: BANDS.f4.y,
    focusHalf: BANDS.f4.half,
    focusAngleHalf: BANDS.f4.angleHalf,
    background: [1, 0, 0],
    sideDim: 0.9,
    escape: 0,
    layout: 1,
    props: 1,
    cap: 0,
    look: 0.6,
  },
];

/**
 * Mobile verticale, base 390×844 (spec 7.3): camera più lontana (la bottiglia
 * deve stare sopra il testo, che occupa il 60–92% dell'altezza) e ancore più
 * alte. Cambiano **solo** quelle due cose: tutto il resto è lo stesso stato,
 * e tenerlo scritto una volta sola è il motivo per cui le ancore esistono.
 */
// - anello più lontano: su un frame stretto le vicine devono stare ai lati
//   della protagonista, non sopra;
// - fronte abbastanza lontano da tenere in quadro il tappo, che allo step
//   dopo salta: dal tappo al centro dell'etichetta sono ~2,9 unità in
//   verticale, il 37% di un frame a 15,5;
// - retro un filo più lontano del desktop e al centro, perché a destra resti
//   spazio per il tappo sospeso
const MOBILE_CAM_Z = [21, 15.5, 10.5, 10.5, 10.5, 10.5, 24] as const;
const MOBILE_SCREEN: readonly Vec3[] = [
  [0.5, 0.31, 0],
  [0.56, 0.48, 0],
  [0.5, 0.32, 0],
  [0.5, 0.32, 0],
  [0.5, 0.32, 0],
  [0.5, 0.32, 0],
  [0.5, 0.4, 0],
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
  | "luce"
  | "focus"
  | "sweep"
  | "tappo";

export type Window = readonly [number, number];
export const FULL_WINDOW: Window = [0, 1];

export interface Segment {
  windows: Partial<Record<Group, Window>>;
  /** ampiezza della lama di luce in questo segmento */
  sweepAmt: number;
}

/** Una voce per segmento: `p` da k a k+1 (spec 7.4). */
export const SEGMENTS: readonly Segment[] = [
  // 0 → 1 · anello → fronte: le altre scappano e faro e piedistallo escono
  // subito, poi la camera si avvicina mentre lei si gira verso la luce
  {
    windows: {
      lati: [0, 0.5],
      camera: [0.1, 1],
      rotazione: [0.1, 1],
      sfondo: [0.15, 0.75],
      luce: [0.3, 1],
      sweep: [0.25, 0.85],
    },
    sweepAmt: 0.5,
  },
  // 1 → 2 · fronte → F1: il mezzo giro. Il tappo salta appena la bottiglia
  // comincia a girare, e vola accanto a lei mentre il retro arriva in camera;
  // la luce si stringe sulla prima fascia per ultima
  {
    windows: {
      rotazione: [0, 0.85],
      camera: [0.1, 1],
      luce: [0, 0.5],
      // all'inizio del segmento, dove la curva di `p` è ancora lenta: nel
      // tratto centrale un volo intero dura un paio di frame e non si vede
      tappo: [0, 0.62],
      focus: [0.45, 1],
      sweep: [0.15, 0.75],
    },
    // non piena: a metà giro la bottiglia è di profilo, e la lama intera la
    // faceva diventare tutta bianca per un paio di frame
    sweepAmt: 0.65,
  },
  // 2 ↔ 3 ↔ 4 ↔ 5 · la fascia accesa scivola sul paragrafo nuovo
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  // 5 → 6 · F4 → gamma: lei finisce il giro e si allontana, le altre entrano
  // dai lati quando la camera ha già fatto spazio, e il tappo si richiude
  // quando sono quasi arrivate
  {
    windows: {
      focus: [0, 0.35],
      rotazione: [0.05, 0.8],
      camera: [0.05, 0.85],
      lati: [0.3, 1],
      sfondo: [0.2, 0.8],
      luce: [0.4, 1],
      tappo: [0.3, 0.92],
      sweep: [0.1, 0.6],
    },
    sweepAmt: 0.6,
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

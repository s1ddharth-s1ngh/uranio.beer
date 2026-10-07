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
  /** luminosità delle bottiglie laterali del carosello */
  sideDim: number;
  /** 0 = laterali in posizione, 1 = scappate fuori dal frame */
  escape: number;
  /** 0 = faro e piedistallo in scena, 1 = usciti dal frame */
  props: number;
}

/** la cima della bottiglia in coordinate locali del pivot */
const CIMA = BOTTLE.maxY - BOTTLE.centerY;
/** una fascia dell'etichetta in coordinate locali del pivot */
const fasciaLocale = (y: number) => y - BOTTLE.centerY;

/** Keyframe desktop, composti su 1440×900 (spec 7.2). */
export const KEYFRAMES: readonly Keyframe[] = [
  // 0 · Hero: carosello, camera lontana e frontale
  {
    camera: { position: [0, 0.4, 17], look: [0, 0.2, 0] },
    rotation: [0.22, 0, 0.3],
    anchor: { localY: 0, screen: [0.5, 0.47] },
    spot: 0.8,
    reveal: 0,
    revealY: SHADER.revealY,
    focus: 0,
    focusY: BANDS.f1.y,
    focusHalf: BANDS.f1.half,
    background: [1, 0, 0],
    sideDim: 0.28,
    escape: 0,
    props: 0,
  },
  // 1 · Primo piano: la cima in alto, solo collo e tappo accesi
  {
    camera: { position: [0, 0, 8], look: [0, 0, 0] },
    rotation: [0.25, 0, 0.42],
    anchor: { localY: CIMA, screen: [0.47, 0.14] },
    spot: 3,
    reveal: 1,
    revealY: SHADER.revealY,
    focus: 0,
    focusY: BANDS.f1.y,
    focusHalf: BANDS.f1.half,
    background: [0, 1, 0],
    sideDim: 0,
    escape: 1,
    props: 1,
  },
  // 2–5 · il retro, una fascia per step: la bottiglia sale e si raddrizza
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
    props: 1,
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
    props: 1,
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
    props: 1,
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
    props: 1,
  },
  // 6 · Finale: giro completo (2π), intera nel frame, nebbia
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
    props: 1,
  },
];

/**
 * Mobile verticale, base 390×844 (spec 7.3): camera più lontana (la bottiglia
 * deve stare sopra il testo, che occupa il 60–92% dell'altezza) e ancore più
 * alte. Cambiano **solo** quelle due cose: tutto il resto è lo stesso stato,
 * e tenerlo scritto una volta sola è il motivo per cui le ancore esistono.
 */
const MOBILE_CAM_Z = [22, 11, 9.5, 9.5, 9.5, 9.5, 19] as const;
const MOBILE_SCREEN: readonly Vec3[] = [
  [0.5, 0.4, 0],
  [0.52, 0.1, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
  [0.56, 0.3, 0],
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
 * I gruppi di proprietà che possono partire in momenti diversi dentro una
 * transizione. Lo sfalsamento è ciò che distingue una regia da un'interpolazione
 * lineare: le laterali scappano subito, la camera arriva dopo, la luce per
 * ultima.
 */
export type Group =
  | "lati"
  | "props"
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
  // 0 → 1 · hero → primo piano
  {
    windows: {
      lati: [0, 0.5],
      props: [0, 0.5],
      sfondo: [0.15, 0.6],
      camera: [0.2, 1],
      rotazione: [0.2, 1],
      reveal: [0.4, 1],
      sweep: [0.3, 0.9],
    },
    sweepAmt: 1,
  },
  // 1 → 2 · primo piano → F1: la rotazione di 180° è il movimento principale
  {
    windows: {
      rotazione: [0, 0.85],
      camera: [0.1, 1],
      reveal: [0, 0.45],
      focus: [0.45, 1],
      sweep: [0.15, 0.75],
    },
    sweepAmt: 1,
  },
  // 2 ↔ 3 ↔ 4 ↔ 5 · la fascia accesa scivola sul paragrafo nuovo
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  { windows: { focus: [0.1, 0.9], sweep: [0.2, 0.8] }, sweepAmt: 0.4 },
  // 5 → 6 · F4 → finale
  {
    windows: {
      focus: [0, 0.35],
      rotazione: [0.1, 0.9],
      camera: [0.1, 1],
      sfondo: [0.2, 0.8],
      sweep: [0.2, 0.8],
    },
    sweepAmt: 1,
  },
];

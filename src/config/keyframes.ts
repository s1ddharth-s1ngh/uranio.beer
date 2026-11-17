// Lo stato 3D di ogni step, e quando ogni cosa si muove dentro una
// transizione (spec 7.2, 7.3, 7.4).
//
// Questo file è dichiarativo di proposito: nessuna logica, solo numeri con un
// nome. Chi interpola è `core/StateMapper.ts`. I valori si regolano dal vivo
// con `?debug` e si ricopiano qui col pulsante "copia keyframe" (regola
// 10.1.6): le ancore e le finestre sono la cosa che più probabilmente va
// ritoccata guardando gli screenshot.

import type { Anchor, CameraSpec } from "./solvePivot.ts";

export type Vec3 = readonly [number, number, number];

export interface Keyframe {
  camera: CameraSpec;
  /** rotazione del pivot in radianti, interpolata come numeri (vedi sotto) */
  rotation: Vec3;
  anchor: Anchor;
  /** intensità dello spot che segue la cima (e il tappo staccato) */
  spot: number;
  /** intensità della luce sulla faccia, da destra in alto (`materials/patchBottle.ts`) */
  face: number;
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

/**
 * il retro: niente anello, niente faro, tappo sospeso. La bottiglia resta
 * **intera** in quadro (la richiesta del 2026-11-17: "mi fa vedere l'intera
 * bottiglia, non solo questa parte"), a destra del testo, e da uno step
 * all'altro gira piano sul retro: niente fasce accese né resto spento, solo
 * luce vera su una bottiglia vera
 */
const RETRO = {
  camera: { position: [0, 0, 11], look: [0, 0, 0] },
  anchor: { localY: 0, screen: [0.64, 0.5] },
  spot: 0.9,
  face: 0.7,
  sideDim: 0,
  escape: 1,
  layout: 1,
  props: 1,
  cap: 1,
  look: 0.6,
} as const;

/**
 * Keyframe desktop, composti su 1440×900 (rivisti il 2026-11-17 sulle note del
 * proprietario):
 *
 * 0. un gruppo stretto di bottiglie, la protagonista al centro fra faro e
 *    piedistallo;
 * 1. lei sola, **intera** e inclinata, la faccia girata in alto a destra e la
 *    luce addosso, il testo a sinistra;
 * 2–5. gira sul retro, e il tappo salta via davanti agli occhi; poi un quarto
 *    di giro lento a ogni step;
 * 6. il giro finisce, le altre tornano in fila, il tappo si richiude:
 *    "ZERO CRISI" e le call to action.
 */
export const KEYFRAMES: readonly Keyframe[] = [
  // 0 · Il gruppo: camera lontana, la protagonista col fondo verso di noi e la
  // cima un filo a sinistra; la faccia già un poco in alto a destra, verso il
  // faro
  {
    camera: { position: [0, 0.4, 14.5], look: [0, 0.2, 0] },
    rotation: [-0.2, 0.22, 0.16],
    anchor: { localY: 0, screen: [0.5, 0.45] },
    spot: 1,
    face: 0.45,
    sideDim: 0.6,
    escape: 0,
    layout: 0,
    props: 0,
    cap: 0,
    look: 1,
  },
  // 1 · Fronte: intera, inclinata con la cima a sinistra, la faccia che guarda
  // in alto a destra, verso la luce. `x` negativo alza la faccia. La camera a
  // 11,5 tiene in quadro tutta la bottiglia inclinata (~4,4 unità di altezza
  // su ~5,7 di frame) e lascia spazio sopra al tappo, che allo step dopo salta
  {
    camera: { position: [0, 0, 11.5], look: [0, 0, 0] },
    rotation: [-0.22, 0.5, 0.36],
    anchor: { localY: 0, screen: [0.64, 0.52] },
    spot: 1.4,
    face: 1,
    sideDim: 0,
    escape: 1,
    layout: 0,
    props: 1,
    cap: 0,
    look: 1,
  },
  // 2–5 · il retro: la bottiglia si raddrizza e gira piano, uno spicchio per
  // step, da poco prima del retro a poco dopo
  { ...RETRO, rotation: [0.08, Math.PI - 0.3, 0.14] },
  { ...RETRO, rotation: [0.06, Math.PI - 0.1, 0.1] },
  { ...RETRO, rotation: [0.05, Math.PI + 0.1, 0.07] },
  { ...RETRO, rotation: [0.04, Math.PI + 0.3, 0.04] },
  // 6 · La gamma e il finale: finito il giro (2π, di nuovo il fronte) le
  // altre arrivano dai lati in fila curva e il tappo torna sul collo.
  // "ZERO CRISI" dietro, le call to action sotto
  {
    camera: { position: [0, 0, 13.5], look: [0, 0, 0] },
    rotation: [0, Math.PI * 2, 0.08],
    anchor: { localY: 0, screen: [0.5, 0.45] },
    spot: 0.8,
    face: 0.35,
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
// - gruppo più lontano: su un frame stretto le vicine devono stare ai lati
//   della protagonista, non sopra;
// - fronte e retro abbastanza lontani da tenere in quadro tutta la bottiglia
//   (e il tappo che salta) sopra il testo, che occupa il 60–92% dell'altezza
const MOBILE_CAM_Z = [21, 16.5, 16, 16, 16, 16, 24] as const;
const MOBILE_SCREEN: readonly Vec3[] = [
  [0.5, 0.31, 0],
  [0.54, 0.33, 0],
  [0.5, 0.33, 0],
  [0.5, 0.33, 0],
  [0.5, 0.33, 0],
  [0.5, 0.33, 0],
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
export type Group = "lati" | "camera" | "rotazione" | "luce" | "tappo";

export type Window = readonly [number, number];
export const FULL_WINDOW: Window = [0, 1];

export interface Segment {
  windows: Partial<Record<Group, Window>>;
}

/** Una voce per segmento: `p` da k a k+1 (spec 7.4). */
export const SEGMENTS: readonly Segment[] = [
  // 0 → 1 · gruppo → fronte: le altre scappano e faro e piedistallo escono
  // subito, poi la camera si avvicina mentre lei si gira verso la luce
  { windows: { lati: [0, 0.5], camera: [0.1, 1], rotazione: [0.1, 1], luce: [0.3, 1] } },
  // 1 → 2 · fronte → retro: il mezzo giro. Il tappo salta **prima** che la
  // bottiglia cominci a girare, a bottiglia ancora di fronte e intera in
  // quadro ("vorrei vedere l'animazione che mi apre il tappo"), e vola
  // accanto a lei mentre il retro arriva in camera
  {
    windows: {
      rotazione: [0.12, 0.9],
      camera: [0.1, 1],
      luce: [0, 0.5],
      // all'inizio del segmento, dove la curva di `p` è ancora lenta: nel
      // tratto centrale un volo intero dura un paio di frame e non si vede
      tappo: [0, 0.55],
    },
  },
  // 2 ↔ 3 ↔ 4 ↔ 5 · uno spicchio di giro, tutto insieme
  { windows: {} },
  { windows: {} },
  { windows: {} },
  // 5 → 6 · retro → gamma: lei finisce il giro e si allontana, le altre entrano
  // dai lati quando la camera ha già fatto spazio, e il tappo si richiude
  // quando sono quasi arrivate
  {
    windows: {
      rotazione: [0.05, 0.8],
      camera: [0.05, 0.85],
      lati: [0.3, 1],
      luce: [0.4, 1],
      tappo: [0.3, 0.92],
    },
  },
];

// Le birre del carosello, la forma dell'anello dell'hero e quella della fila
// della gamma (spec 6.6).
//
// Oggi di birre ce n'è una, Crisi Economica: tutti gli slot del carosello
// mostrano lei. L'elenco esiste comunque, perché il giorno in cui arrivano le
// altre (domanda aperta 10.2) l'unica cosa da fare è aggiungere una riga qui.

import { MODEL_URL } from "./bottle.ts";
import { COLORS } from "./theme.ts";

export interface Beer {
  id: string;
  name: string;
  style: string;
  abv: string;
  /** il GLB: per ora uno solo, con l'etichetta già dentro */
  modelUrl: string;
  /** colore della rim light dedicata nel carosello */
  accent: string;
}

export const BEERS: readonly Beer[] = [
  {
    id: "crisi-economica",
    name: "CRISI ECONOMICA",
    style: "ORDINARY BITTER",
    abv: "4,2%",
    modelUrl: MODEL_URL,
    accent: COLORS.red,
  },
];

/**
 * L'anello dell'hero, allo step 0 (riferimento ciaoenergy.com: le lattine in
 * cerchio attorno a quella al centro, le laterali più scure). Sono gli stessi
 * cloni della gamma (`gl/Carousel.tsx`), in un'altra posa. L'anello è
 * **tangente** alla camera: `z = (cos a − 1)·R` tiene la protagonista a z = 0
 * e manda indietro le altre, così quella al centro è sempre la più vicina.
 *
 * Raggio e passo per formato, scelti sulle proporzioni del riferimento: a
 * 1440×900 le due vicine stanno a ~¼ e ¾ della larghezza, le seconde sui
 * bordi, le terze tagliate a metà; su telefono le vicine a ~⅕ e ⅘.
 */
export const RING = {
  desktop: { radius: 9, step: 0.33 },
  portrait: { radius: 5, step: 0.46 },
  mobile: { radius: 3.4, step: 0.5 },
  /** l'anello è inclinato: sale verso destra di tanto per unità di x */
  rise: 0.1,
  /** varietà per slot, attorno alla posa della protagonista */
  jitter: { x: 0.14, y: 0.15, z: 0.12, yaw: 0.55 },
  /** chi sta a sinistra pende a destra e viceversa, come un ventaglio */
  fan: 0.1,
  /** quanto si spengono girando verso il fondo dell'anello (∝ 1 − cos a) */
  depthDim: 0.5,
  /**
   * Oltre questo scarto dal centro l'anello gira dietro la protagonista: le
   * bottiglie lì finirebbero in fondo, ammucchiate dietro le altre. Nella
   * fila ci sono tutte, nell'anello no (sette, come nel riferimento).
   */
  maxOffset: 3,
} as const;

/** Il raggio e il passo dell'anello per questo viewport. */
export function ringFor(vp: { mobile: boolean; portrait: boolean }) {
  if (vp.mobile) return RING.mobile;
  return vp.portrait ? RING.portrait : RING.desktop;
}

/**
 * La fila della gamma, all'ultimo step. Lo slot 0 è la protagonista, al centro: è
 * la **stessa** bottiglia che vive tutta l'esperienza, non una copia. Le
 * altre (`gl/Carousel.tsx`) sono cloni che compaiono qui e nell'anello. Misure in unità
 * di scena relative al pivot della protagonista; la camera dell'ultimo keyframe sta
 * a 13,5, dove 1440×900 inquadra ~10,8 unità di larghezza: le bottiglie
 * quasi si toccano e la fila riempie il frame, come le lattine del
 * riferimento.
 */
export const GAMMA = {
  /** quante bottiglie in tutto, protagonista compresa */
  count: 9,
  /** su mobile il frame è stretto: nove sarebbero una fila di francobolli */
  countMobile: 5,
  /** passo orizzontale, poco più di un corpo: le due estreme escono a metà dai bordi */
  spacing: 1.38,
  /** di quanto sale la fila a ogni passo verso destra */
  rise: 0.3,
  /** quanto si piegano in basso i due capi (∝ passo²) */
  arc: 0.07,
  /** quanto arretrano i capi (∝ passo²): la fila è un arco anche in pianta */
  depth: 0.12,
  /** inclinazione in avanti per passo: fondi a sinistra, tappi a destra */
  twist: 0.08,
  /** pendenza comune e sua varietà per slot */
  lean: 0.1,
  leanJitter: 0.05,
  /** varietà del verso dell'etichetta */
  yawMax: 0.3,
  /** fluttuazione a riposo */
  life: { yAmp: 0.05, ySpeed: 0.6, zAmp: 0.02, zSpeed: 0.4 },
  /** entrata e uscita: da quanto lontano arrivano, dalla loro parte */
  escapeX: 9,
  escapeZ: 4,
} as const;

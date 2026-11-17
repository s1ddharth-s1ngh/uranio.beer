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
 * L'anello dell'hero, allo step 0: le stesse copie della gamma
 * (`gl/Carousel.tsx`) in un'altra posa. L'anello è **tangente** alla camera:
 * `z = (cos a − 1)·R` tiene la protagonista a z = 0 e manda indietro le
 * altre, così quella al centro è sempre la più vicina.
 *
 * Un gruppo stretto, non un girotondo (richiesta del 2026-11-17: "ci sono un
 * paio di bottiglie in più... non tutte alla distanza di 200 km"): cinque
 * bottiglie, la protagonista e due per parte. L'arco è corto e profondo, così
 * le esterne finiscono un poco dietro le vicine e il gruppo si legge come un
 * grappolo; a 1440×900 occupa poco più della metà centrale del frame.
 */
export const RING = {
  desktop: { radius: 3.6, step: 0.5 },
  portrait: { radius: 4, step: 0.42 },
  // sul telefono il frame è stretto: arco ancora più corto, o le due esterne
  // finiscono a metà fuori dai bordi
  mobile: { radius: 2, step: 0.55 },
  /** l'anello è inclinato: sale verso destra di tanto per unità di x */
  rise: 0.06,
  /** varietà per slot, attorno alla posa della protagonista: poca, è un gruppo */
  jitter: { x: 0.08, y: 0.06, z: 0.06, yaw: 0.4 },
  /** chi sta a sinistra pende a destra e viceversa, come un ventaglio */
  fan: 0.07,
  /** quanto si spengono girando verso il fondo dell'anello (∝ 1 − cos a) */
  depthDim: 0.35,
  /**
   * Quante per parte stanno nell'anello: le altre compaiono solo nella fila
   * del finale. Due per parte, più la protagonista: cinque.
   */
  maxOffset: 2,
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
  /** entrata e uscita: da quanto lontano arrivano, dalla loro parte */
  escapeX: 9,
  escapeZ: 4,
} as const;

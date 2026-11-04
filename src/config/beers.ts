// Le birre del carosello e la forma dell'anello (spec 6.6).
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
 * La fila della gamma, allo step 5. Lo slot 0 è la protagonista, al centro: è
 * la **stessa** bottiglia che vive tutta l'esperienza, non una copia. Le
 * altre (`gl/Carousel.tsx`) sono cloni che compaiono solo qui. Misure in unità
 * di scena relative al pivot della protagonista; la camera del keyframe 5 sta
 * a 16, dove 1440×900 inquadra ~12,8 unità di larghezza.
 */
export const GAMMA = {
  /** quante bottiglie in tutto, protagonista compresa */
  count: 9,
  /** su mobile il frame è stretto: nove sarebbero una fila di francobolli */
  countMobile: 5,
  /** passo orizzontale: le due estreme escono a metà dai bordi */
  spacing: 1.62,
  /** di quanto sale la fila a ogni passo verso destra */
  rise: 0.36,
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

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
 * L'anello dell'hero. Lo slot 0 è la protagonista, al centro e davanti: è la
 * **stessa** bottiglia che poi vive tutta l'esperienza, non una copia. Il
 * carosello aggiunge gli altri slot.
 */
export const CAROUSEL = {
  /** quante bottiglie in tutto, protagonista compresa */
  count: 9,
  /** su mobile il frame è stretto: nove sarebbero una fila di francobolli */
  countMobile: 5,
  /**
   * Raggio dell'anello. A 1440×900 con questo valore si vedono sette
   * bottiglie, le estreme tagliate dai bordi come nel riferimento; è il primo
   * numero da ritoccare guardando (task 8.13).
   */
  radius: 6,
  /** luminosità delle laterali: presenti ma chiaramente di sfondo */
  sideDim: 0.28,
  /** inclinazioni: fasce da cui pescare, con un seme fisso per slot */
  tilt: { xMin: 0.15, xMax: 0.3, zMax: 0.3, yOffsetMax: 0.35 },
  /** fluttuazione a riposo */
  life: { yAmp: 0.05, ySpeed: 0.6, zAmp: 0.02, zSpeed: 0.4, spin: 0.15 },
  /** trascinamento: radianti per pixel */
  dragPerPixel: 0.004,
  /**
   * Sopra questa velocità (rad/s) il rilascio conta come uno scatto e porta
   * avanti di uno slot in più: senza, un colpetto veloce ma corto tornerebbe
   * indietro e su telefono il carosello sembrerebbe morto.
   */
  flickVelocity: 1.6,
  /** l'aggancio dopo il rilascio (spec 6.6) */
  snapDuration: 0.8,
  /** uscita verso il primo piano: di quanto scappano fuori dal frame */
  escapeX: 8,
  escapeZ: 4,
} as const;

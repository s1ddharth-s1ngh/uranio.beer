// Lo sfondo (spec 6.8): tre atmosfere in un solo shader, pesate da `p`.

import { COLORS } from "./theme.ts";

export const BG = {
  /**
   * Metà risoluzione. Sono gradienti e nebbia: non c'è niente di nitido da
   * perdere, e a tutto schermo un fragment shader con cinque ottave di fbm a
   * DPR pieno costa più di tutta la bottiglia.
   */
  dpr: 0.5,
  /**
   * Al massimo 30 disegni al secondo (task 8.27): la nebbia respira in
   * decine di secondi, a 60 fps non si vedrebbe la differenza.
   */
  maxFps: 30,
  /** il pavimento da studio dell'hero: grigio chiaro, non bianco */
  floor: "#5E5E5E",
  /** gli sbuffi più chiari della nebbia del finale */
  fog3: "#FFC2B8",
  /**
   * grana su tutto, cambia a ogni frame: è ciò che evita le bande. In spazio
   * display (dopo la conversione sRGB): ±3 livelli su 255 bastano a
   * sciogliere gli scalini senza vedersi come trama
   */
  grain: 0.024,
  /** quanto lenta respira la nebbia */
  timeScale: 0.03,
} as const;

/** i colori che vanno nello shader, nell'ordine in cui li legge */
export const BG_COLORS = {
  cBlack: COLORS.black,
  cFloor: BG.floor,
  cRed: COLORS.red,
  cAmber: COLORS.amber,
  cOx: COLORS.oxblood,
  cNight: COLORS.night,
  cFog1: COLORS.fog1,
  cFog2: COLORS.fog2,
  cFog3: BG.fog3,
  cDeep: COLORS.redDeep,
} as const;

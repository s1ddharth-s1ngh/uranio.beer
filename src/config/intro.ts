// L'ingresso dopo il preloader (spec 8.22): faro, bottiglie, interfaccia.
// Tempi in secondi dentro la durata totale; `core/Intro.ts` li traduce in
// funzioni di `intro` ∈ [0, 1].

export const INTRO = {
  /** totale dell'ingresso (spec 8.22) */
  duration: 2.2,
  /**
   * Il faro si accende come un neon: due sfarfallii e poi pieno. Coppie
   * `[istante, livello]`, a gradini: il livello vale da quell'istante fino al
   * successivo. L'ultimo deve essere 1, o il faro resterebbe a mezza luce.
   */
  faro: [
    [0, 0],
    [0.12, 0.7],
    [0.2, 0.1],
    [0.34, 0.9],
    [0.4, 0.25],
    [0.55, 1],
  ] as readonly (readonly [number, number])[],
  bottles: {
    /** quando parte la prima: il faro ha già finito di sfarfallare */
    start: 0.45,
    /** sfalsamento fra uno slot e il successivo (spec 8.22) */
    stagger: 0.06,
    /** quanto dura la salita di ciascuna */
    rise: 1.0,
    /**
     * Da quanto sotto partono, in unità di scena. Basta a mettere sotto il
     * bordo basso anche le laterali più lontane: lo controlla `verify:core`
     * proiettando la cima di ogni bottiglia.
     */
    drop: 14,
  },
  /** quando entrano nome, slider e invito: per ultimi (task 8.19) */
  ui: 1.85,
} as const;

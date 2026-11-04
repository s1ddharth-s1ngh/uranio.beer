// L'ingresso dell'esperienza (spec 8.22, rivisto il 2026-11-04): la
// bottiglia arriva al suo posto dello step 0, dal basso e girando, poi entra
// il titolo. Tempi in secondi; `core/Intro.ts` li traduce in funzioni di
// `intro` ∈ [0, 1].

export const INTRO = {
  /** totale dell'ingresso */
  duration: 1.8,
  bottle: {
    /** quando parte: subito, il passaggio dal hero ha già fatto da attesa */
    start: 0,
    /** quanto dura la salita */
    rise: 1.4,
    /**
     * Da quanto sotto parte, in unità di scena: basta a metterla tutta sotto
     * il bordo basso a ogni formato (lo controlla `verify:core`).
     */
    drop: 9,
    /** quanto le manca del giro sul proprio asse, in radianti */
    spin: Math.PI,
  },
  /** quando entrano titolo e invito: a bottiglia quasi ferma */
  ui: 1.1,
} as const;

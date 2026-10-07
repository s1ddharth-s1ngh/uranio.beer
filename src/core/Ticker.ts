// Un solo loop per tutta l'esperienza (spec 4.1): `gsap.ticker`.
//
// Non è un wrapper per il gusto di averne uno. GSAP ha già il suo
// requestAnimationFrame per i tween di `p`, e R3F ne aprirebbe un secondo per
// il canvas: due loop sullo stesso frame significano ordini di esecuzione non
// garantiti (la scena può leggere `p` prima o dopo che il tween l'ha scritto,
// a seconda di chi si è registrato per primo) e due budget da rispettare
// invece di uno. Qui il Canvas R3F gira con `frameloop="never"` e viene
// avanzato da questo ticker: il tween scrive, poi si disegna. Sempre.

import gsap from "gsap";

/** `time` in secondi dall'avvio, `delta` in secondi dal frame precedente. */
export type TickFn = (time: number, delta: number) => void;

/**
 * Aggancia una funzione al ticker. Restituisce la funzione per staccarla:
 * negli `useEffect` è il cleanup, e dimenticarsene è il modo classico di
 * accumulare loop fantasma a ogni hot reload.
 */
export function onTick(fn: TickFn): () => void {
  // gsap passa il delta in millisecondi; dentro l'esperienza si ragiona in
  // secondi come nel resto di three.js, così non c'è da convertire ogni volta.
  const wrapped = (time: number, deltaMs: number) => fn(time, deltaMs / 1000);
  gsap.ticker.add(wrapped);
  return () => gsap.ticker.remove(wrapped);
}

/** Il tempo del ticker, per chi deve animare senza registrarsi. */
export function tickerTime(): number {
  return gsap.ticker.time;
}

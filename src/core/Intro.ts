// L'ingresso dopo il preloader (spec 8.22), come funzione di un numero.
//
// La stessa filosofia di `p`: un valore `intro` da 0 a 1 che GSAP anima una
// volta sola, e funzioni pure che dicono quanto è acceso il faro, dove sta
// ogni bottiglia e quando entra l'interfaccia. I componenti `gl/` sommano il
// risultato allo stato di `p` nel loro `useFrame`. Niente DOM: si prova in
// Node (`npm run verify:core`).

import gsap from "gsap";
import { INTRO } from "../config/intro.ts";

/** secondi dall'inizio dell'ingresso */
const secondi = (intro: number) => Math.min(1, Math.max(0, intro)) * INTRO.duration;

/** frena all'arrivo; vale esattamente 0 e 1 agli estremi */
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Livello del faro e dello spot, 0–1: due sfarfallii da neon, poi pieno. */
export function faroLevel(intro: number): number {
  const t = secondi(intro);
  let livello = 0;
  for (const [da, v] of INTRO.faro) {
    if (t >= da) livello = v;
  }
  return livello;
}

/**
 * In che ordine salgono le bottiglie: prima la protagonista, poi a coppie
 * verso l'esterno (destra, sinistra, destra…). Per numero di slot l'ordine
 * girerebbe tutto l'anello da una parte sola.
 */
export function introOrder(slot: number, count: number): number {
  return slot <= count / 2 ? Math.max(0, 2 * slot - 1) : 2 * (count - slot);
}

/** Avanzamento della salita di uno slot, 0 sotto il frame e spento, 1 a posto. */
export function slotRise(intro: number, slot: number, count: number): number {
  const { start, stagger, rise } = INTRO.bottles;
  const t = secondi(intro) - start - introOrder(slot, count) * stagger;
  return easeOut(Math.min(1, Math.max(0, t / rise)));
}

/** Di quanto abbassare uno slot: si somma alla y dello stato. */
export function slotDrop(intro: number, slot: number, count: number): number {
  return -(1 - slotRise(intro, slot, count)) * INTRO.bottles.drop;
}

/** la soglia oltre la quale entra l'interfaccia dell'hero */
export const UI_AT = INTRO.ui / INTRO.duration;

/**
 * Il valore condiviso. Parte da 0: chi monta la scena decide se far partire
 * l'ingresso (`play`) o saltarlo (`skip`: preloader già visto in questa
 * sessione, o movimento ridotto).
 */
export class Intro {
  value = 0;
  private tween: gsap.core.Tween | undefined;
  private subs = new Set<() => void>();

  /** vero quando l'interfaccia dell'hero può entrare */
  get uiReady(): boolean {
    return this.value >= UI_AT;
  }

  /** Per `useSyncExternalStore`: avvisa solo quando `uiReady` cambia. */
  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };

  play() {
    if (this.tween || this.value >= 1) return;
    let pronta = this.uiReady;
    this.tween = gsap.to(this, {
      value: 1,
      duration: INTRO.duration * (1 - this.value),
      ease: "none",
      onUpdate: () => {
        if (pronta === this.uiReady) return;
        pronta = this.uiReady;
        this.notify();
      },
      onComplete: () => {
        this.tween = undefined;
      },
    });
  }

  skip() {
    this.tween?.kill();
    this.tween = undefined;
    const prima = this.uiReady;
    this.value = 1;
    if (!prima) this.notify();
  }

  private notify() {
    for (const fn of this.subs) fn();
  }
}

let shared: Intro | undefined;

export function sharedIntro(): Intro {
  shared ??= new Intro();
  return shared;
}

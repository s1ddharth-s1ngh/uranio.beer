// L'ingresso dell'esperienza (spec 8.22), come funzione di un numero.
//
// La stessa filosofia di `p`: un valore `intro` da 0 a 1 che GSAP anima una
// volta sola, e funzioni pure che dicono dove sta la bottiglia che arriva e
// quando entra l'interfaccia. I componenti `gl/` sommano il
// risultato allo stato di `p` nel loro `useFrame`. Niente DOM: si prova in
// Node (`npm run verify:core`).

import gsap from "gsap";
import { INTRO } from "../config/intro.ts";

/** secondi dall'inizio dell'ingresso */
const secondi = (intro: number) => Math.min(1, Math.max(0, intro)) * INTRO.duration;

/** frena all'arrivo; vale esattamente 0 e 1 agli estremi */
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Avanzamento dell'arrivo della bottiglia: 0 sotto il frame e spenta, 1 a posto. */
export function bottleRise(intro: number): number {
  const { start, rise } = INTRO.bottle;
  return easeOut(Math.min(1, Math.max(0, (secondi(intro) - start) / rise)));
}

/** Di quanto abbassarla: si somma alla y dello stato. */
export function bottleDrop(intro: number): number {
  return -(1 - bottleRise(intro)) * INTRO.bottle.drop;
}

/** Quanto giro le manca: si sottrae alla rotazione sul proprio asse. */
export function bottleSpin(intro: number): number {
  return (1 - bottleRise(intro)) * INTRO.bottle.spin;
}

/**
 * Avanzamento dell'arrivo di una delle altre dell'anello: come la
 * protagonista, in ritardo di `|scarto| × stagger` (`core/Carousel.ts`).
 */
export function slotRise(intro: number, offset: number): number {
  const { start, rise } = INTRO.bottle;
  const t = secondi(intro) - start - Math.abs(offset) * INTRO.stagger;
  return easeOut(Math.min(1, Math.max(0, t / rise)));
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

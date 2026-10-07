// `p`, il numero che regge tutta l'esperienza (spec 4).
//
// Lo stato 3D è una funzione pura di `p` ∈ [0, LAST_STEP]: lo scroll non muove
// la pagina, sceglie lo step di destinazione e GSAP anima `p` fin lì. Andata,
// ritorno e salti con le icone funzionano di conseguenza, senza codice loro.
//
// Qui non si tocca il DOM: niente `history`, niente listener. Così la classe
// si esegue in Node (`npm run verify:core`), che è il solo modo di provare il
// motore su questa macchina.

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import {
  EASE_NAME,
  EASE_PATH,
  LAST_STEP,
  REDUCED_DURATION,
  SCROLL,
  STEP_DURATION,
} from "../config/theme.ts";

gsap.registerPlugin(CustomEase);
// La curva del tween di `p`: parte piano, accelera, atterra molto morbida.
// Registrata una volta sola per nome, così tween e debug la condividono.
if (!CustomEase.get(EASE_NAME)) CustomEase.create(EASE_NAME, EASE_PATH);

export interface StepLeaveDetail {
  from: number;
  to: number;
}
export interface StepEnterDetail {
  step: number;
}

/**
 * Durata della corsa da `from` a `to` (spec 5.2 e regola 5.1.7).
 *
 * `from` può essere frazionario: con un'inversione a metà transizione si
 * riparte da dove si è, non dallo step.
 */
export function durationFor(
  from: number,
  to: number,
  reducedMotion = false,
): number {
  if (reducedMotion) return REDUCED_DURATION;
  const dist = Math.abs(to - from);
  // il segmento di partenza decide il ritmo: hero e finale sono più lenti
  const i = Math.min(
    STEP_DURATION.length - 1,
    Math.max(0, Math.floor(Math.min(from, to))),
  );
  const base = STEP_DURATION[i];
  if (dist <= 1) return base * Math.max(dist, 0.001);
  // salto con le icone: si passa dagli step intermedi senza fermarsi
  return Math.min(
    base + SCROLL.jumpExtraPerStep * (dist - 1),
    SCROLL.jumpMaxDuration,
  );
}

export interface ProgressOptions {
  /** ultimo step valido; `p` vive in [0, last] */
  last?: number;
  /** step di partenza, da `#step-N` nell'URL (spec 5.1 regola 8) */
  start?: number;
  /**
   * Interrogata a ogni corsa, non letta una volta: l'utente può cambiare
   * l'impostazione di sistema a pagina aperta, e un campo da riassegnare
   * dall'esterno sarebbe uno stato mutabile in più da tenere in sincrono.
   */
  reducedMotion?: () => boolean;
}

export class Progress extends EventTarget {
  /** il valore continuo che tutti leggono, scritto solo dai tween */
  p: number;
  /** lo step di destinazione: è questo che decide i testi, non `p` */
  target: number;
  readonly last: number;
  readonly reducedMotion: () => boolean;

  private tween: gsap.core.Tween | undefined;
  private rimbalzo: gsap.core.Tween | undefined;
  private inCorsa = false;

  constructor({
    last = LAST_STEP,
    start = 0,
    reducedMotion = () => false,
  }: ProgressOptions = {}) {
    super();
    this.last = last;
    this.reducedMotion = reducedMotion;
    this.p = Math.max(0, Math.min(last, start));
    this.target = this.p;
  }

  /**
   * Vero mentre una transizione è in corso (il rimbalzo ai bordi non conta).
   *
   * Lo teniamo noi invece di chiedere `tween.isActive()`: GSAP considera il
   * tween "attivo" solo dal primo tick dopo la creazione, e nel frattempo il
   * lock della regola 5.1.4 sarebbe aperto. Un frame di buco basta a far
   * passare due gesti.
   */
  get moving(): boolean {
    return this.inCorsa;
  }

  /**
   * Un gesto chiede di andare a `next` muovendosi in direzione `dir`.
   * Applica le regole 5.1.4 e 5.1.6: durante una transizione i gesti nello
   * stesso verso si ignorano, quelli nel verso opposto invertono subito.
   */
  request(next: number, dir: number) {
    const want = Math.max(0, Math.min(this.last, next));
    if (want === this.target) {
      // già lì: o il gesto ripete il target, o siamo contro un bordo
      if (!this.moving) this.bounceIfEdge(dir);
      return;
    }
    if (this.moving && Math.sign(want - this.p) === Math.sign(this.target - this.p)) {
      return;
    }
    this.goTo(want);
  }

  /**
   * Va allo step, sempre: è la porta per le icone (regola 5.1.7), che saltano
   * anche a transizione in corso.
   */
  goTo(next: number) {
    const to = Math.max(0, Math.min(this.last, next));
    const from = this.target;
    this.target = to;
    this.dispatchEvent(
      new CustomEvent<StepLeaveDetail>("step:leave", { detail: { from, to } }),
    );
    this.kill();
    this.inCorsa = true;
    this.tween = gsap.to(this, {
      p: to,
      ease: EASE_NAME,
      duration: durationFor(this.p, to, this.reducedMotion()),
      onComplete: () => {
        this.tween = undefined;
        this.inCorsa = false;
        this.dispatchEvent(
          new CustomEvent<StepEnterDetail>("step:enter", { detail: { step: to } }),
        );
      },
    });
  }

  /** Salta allo step senza animazione: avvio da `#step-N`. */
  jump(step: number) {
    this.kill();
    this.p = this.target = Math.max(0, Math.min(this.last, step));
    this.dispatchEvent(
      new CustomEvent<StepEnterDetail>("step:enter", { detail: { step: this.target } }),
    );
  }

  dispose() {
    this.kill();
  }

  private kill() {
    this.tween?.kill();
    this.tween = undefined;
    this.inCorsa = false;
    this.rimbalzo?.kill();
    this.rimbalzo = undefined;
  }

  /**
   * Contro un bordo il gesto non va perso: `p` esce di un filo e torna. Serve
   * a dire "non c'è altro da questa parte" senza fermare la scena.
   */
  private bounceIfEdge(dir: number) {
    const contro =
      (dir < 0 && this.target === 0) || (dir > 0 && this.target === this.last);
    if (!contro || this.rimbalzo?.isActive()) return;
    this.rimbalzo = gsap.to(this, {
      p: this.target + dir * SCROLL.bounceAmount,
      duration: SCROLL.bounceDuration / 2,
      ease: "power2.inOut",
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        // il yoyo riporta `p` al valore di partenza, ma non a mano: con un
        // tween interrotto a metà resterebbe a metà strada
        this.p = this.target;
        this.rimbalzo = undefined;
      },
    });
  }
}

/**
 * Un solo `Progress` per pagina: `p` è lo stato globale dell'esperienza e
 * passarlo per props attraverso dieci componenti non lo renderebbe meno
 * globale. Lo stesso schema di `sharedViewport()`.
 */
let shared: Progress | undefined;

export function sharedProgress(opts?: ProgressOptions): Progress {
  shared ??= new Progress(opts);
  return shared;
}

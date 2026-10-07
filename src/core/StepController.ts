// Dal gesto allo step (spec 5.1).
//
// Il problema vero non è leggere la rotella: è capire **quante intenzioni** ci
// sono dentro un flusso di eventi. Un trackpad manda decine di `wheel` che
// calano per circa un secondo dopo una sola spinta; preso alla lettera
// salterebbe cinque step. Un mouse a scatti manda un evento secco per tacca.
// Entrambi devono fare uno step per gesto.
//
// La logica di riconoscimento sta in classi/funzioni pure (`WheelGesture`,
// `swipeDirection`, `keyIntent`): niente DOM, così si provano in Node. La
// classe `StepController` è solo il cablaggio degli ascoltatori.

import { SCROLL } from "../config/theme.ts";
import type { Progress } from "./Progress.ts";

/**
 * Accumula i `wheel` e dice quando è nato un gesto nuovo.
 * `feed()` restituisce la direzione dello step da fare, 0 se non è il momento.
 */
export class WheelGesture {
  private acc = 0;
  private lastT = -Infinity;
  private lastAbs = 0;
  private peak = 0;
  private fired = false;

  /**
   * @param deltaMode 0 px, 1 righe, 2 pagine (spec 5.1 regola 2)
   * @param now `performance.now()`
   * @param viewportHeight serve solo per `deltaMode = 2`
   */
  feed(
    deltaY: number,
    deltaMode: number,
    now: number,
    viewportHeight: number,
  ): number {
    const k = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
    const d = deltaY * k;
    const abs = Math.abs(d);
    // Gesto nuovo se c'è stata una pausa, oppure se il delta risale dentro la
    // coda del gesto precedente: la seconda spinta di un trackpad arriva
    // prima che l'inerzia della prima sia finita, e l'accelerazione è l'unico
    // segnale che la distingue dall'inerzia stessa.
    //
    // Le due condizioni in più rispetto alla spec (regola 5.1.3) ci sono
    // perché senza di esse una spinta sola conta per tre: anche la **salita**
    // iniziale accelera (1, 5, 12, 30, 50 px) e verrebbe letta come intenzioni
    // nuove. Quindi la risalita vale solo se un gesto ha già fatto scattare
    // uno step (`fired`) e se la sua onda è già sgonfiata sotto metà del
    // picco. Correzione annotata in `docs/AUDIT.md`.
    const risale =
      this.fired &&
      abs > this.lastAbs * SCROLL.newGestureRatio &&
      abs > SCROLL.newGestureMinPx &&
      this.lastAbs < this.peak * SCROLL.newGestureTailFraction;
    const nuovo = now - this.lastT > SCROLL.newGestureMs || risale;
    this.lastT = now;
    this.lastAbs = abs;
    if (nuovo) {
      this.acc = 0;
      this.peak = abs;
      this.fired = false;
    }
    this.peak = Math.max(this.peak, abs);
    if (this.fired) return 0;
    this.acc += d;
    if (Math.abs(this.acc) < SCROLL.triggerPx) return 0;
    this.fired = true;
    return Math.sign(this.acc);
  }

  reset() {
    this.acc = 0;
    this.lastAbs = 0;
    this.peak = 0;
    this.fired = false;
  }
}

/**
 * Direzione di uno swipe su `touchend` (spec 5.1 regola 5).
 * `dy` è lo spostamento del dito: negativo quando va verso l'alto, cioè
 * quando l'utente chiede di andare avanti.
 */
export function swipeDirection(dy: number, dtMs: number): number {
  const abs = Math.abs(dy);
  const v = dtMs > 0 ? abs / dtMs : 0;
  if (abs < SCROLL.swipePx && v < SCROLL.swipeVelocity) return 0;
  return -Math.sign(dy);
}

export type KeyIntent = { dir: number } | { to: "first" | "last" } | null;

/** Tastiera (spec 5.1 regola 1). */
export function keyIntent(key: string, shift: boolean): KeyIntent {
  switch (key) {
    case "ArrowDown":
    case "PageDown":
      return { dir: 1 };
    case "ArrowUp":
    case "PageUp":
      return { dir: -1 };
    case " ":
    case "Spacebar":
      return { dir: shift ? -1 : 1 };
    case "Home":
      return { to: "first" };
    case "End":
      return { to: "last" };
    default:
      return null;
  }
}

export class StepController {
  private wheel = new WheelGesture();
  private touchY = 0;
  private touchT = 0;
  private progress: Progress;
  private root: HTMLElement;

  constructor(progress: Progress, root: HTMLElement) {
    this.progress = progress;
    this.root = root;
    // `passive: false` perché serve il `preventDefault`: senza, Chrome scrolla
    // la pagina sotto l'esperienza mentre noi animiamo `p`
    root.addEventListener("wheel", this.onWheel, { passive: false });
    root.addEventListener("touchstart", this.onTouchStart, { passive: true });
    root.addEventListener("touchmove", this.onTouchMove, { passive: false });
    root.addEventListener("touchend", this.onTouchEnd, { passive: true });
    window.addEventListener("keydown", this.onKey);
  }

  dispose() {
    this.root.removeEventListener("wheel", this.onWheel);
    this.root.removeEventListener("touchstart", this.onTouchStart);
    this.root.removeEventListener("touchmove", this.onTouchMove);
    this.root.removeEventListener("touchend", this.onTouchEnd);
    window.removeEventListener("keydown", this.onKey);
  }

  private step(dir: number) {
    if (dir !== 0) this.progress.request(this.progress.target + dir, dir);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.step(
      this.wheel.feed(e.deltaY, e.deltaMode, performance.now(), window.innerHeight),
    );
  };

  private onTouchStart = (e: TouchEvent) => {
    this.touchY = e.touches[0]?.clientY ?? 0;
    this.touchT = performance.now();
  };

  // il dito non deve trascinare la pagina: dentro l'esperienza il movimento
  // verticale è nostro
  private onTouchMove = (e: TouchEvent) => e.preventDefault();

  private onTouchEnd = (e: TouchEvent) => {
    const y = e.changedTouches[0]?.clientY ?? this.touchY;
    this.step(swipeDirection(y - this.touchY, performance.now() - this.touchT));
  };

  private onKey = (e: KeyboardEvent) => {
    // se il fuoco è su un controllo, la tastiera è sua (regola 8.24)
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      return;
    }
    const intent = keyIntent(e.key, e.shiftKey);
    if (!intent) return;
    e.preventDefault();
    if ("to" in intent) {
      this.progress.goTo(intent.to === "first" ? 0 : this.progress.last);
    } else {
      this.step(intent.dir);
    }
  };
}

// Dal gesto allo step (spec 5.1).
//
// Il problema vero non è leggere la rotella: è capire **quante intenzioni** ci
// sono dentro un flusso di eventi. Un trackpad manda decine di `wheel` che
// calano per circa un secondo dopo una sola spinta; preso alla lettera
// salterebbe cinque step. Un mouse a scatti manda un evento secco per tacca.
// Entrambi devono fare uno step per gesto.
//
// La logica di riconoscimento sta in classi/funzioni pure (`WheelGesture`,
// `swipeDirection`, `keyIntent`, `edgeAction`): niente DOM, così si provano
// in Node. La classe `StepController` è solo il cablaggio degli ascoltatori.

import { SCROLL } from "../config/theme.ts";
import type { Progress } from "./Progress.ts";

/** Il delta della rotella in px (spec 5.1 regola 2): righe ×16, pagine × altezza. */
export function wheelPx(deltaY: number, deltaMode: number, viewportHeight: number): number {
  return deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1);
}

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
    const d = wheelPx(deltaY, deltaMode, viewportHeight);
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

  /**
   * Dichiara "sparato" il gesto in corso: la sua coda d'inerzia non farà
   * step. Serve al riaggancio, che il gesto lo ha già usato.
   */
  consume() {
    this.fired = true;
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
 *
 * `dy` è lo spostamento del dito: negativo quando va verso l'alto, cioè
 * quando l'utente chiede di andare avanti. `dx` serve a lasciar passare i
 * gesti orizzontali: nell'hero sono il trascinamento del carosello (spec
 * 6.6), e senza questo controllo ogni giro di carosello su telefono
 * cambierebbe anche lo step.
 */
export function swipeDirection(dy: number, dtMs: number, dx = 0): number {
  const abs = Math.abs(dy);
  if (Math.abs(dx) > abs) return 0;
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

/**
 * Che cosa ha il fuoco, per quanto riguarda la tastiera: un campo di testo
 * (tutti i tasti sono suoi), un controllo che si preme (bottone, link,
 * `summary`) o niente di interessante.
 */
export type FocusKind = "testo" | "controllo" | null;

/**
 * Il tasto spetta all'elemento col fuoco e non all'esperienza? (task 8.24)
 *
 * Su un controllo lo Spazio lo preme: il motore non deve farci uno step né
 * chiamare `preventDefault`, che annullerebbe il click. Le frecce, PagSu/Giù,
 * Home e Fine restano all'esperienza; Invio non è mai un tasto del motore.
 */
export function keyBelongsToFocus(key: string, focus: FocusKind): boolean {
  if (focus === "testo") return true;
  return focus === "controllo" && (key === " " || key === "Spacebar");
}

const TESTO = "input, textarea, select";
const CONTROLLO = "button, a[href], [role=button], summary";

function focusKind(t: EventTarget | null): FocusKind {
  if (!(t instanceof HTMLElement)) return null;
  if (t.isContentEditable || t.closest(TESTO)) return "testo";
  return t.closest(CONTROLLO) ? "controllo" : null;
}

export type EdgeAction = "step" | "rimbalzo" | "sblocca" | "riaggancia" | "nativo";

export interface EdgeState {
  target: number;
  last: number;
  moving: boolean;
  /** verso del gesto: +1 avanti (giù), −1 indietro, 0 nessuno */
  dir: number;
  /** sotto l'esperienza c'è altro contenuto da raggiungere */
  haSotto: boolean;
  /** lo scroll è già stato restituito alla pagina */
  sbloccato: boolean;
  scrollY: number;
}

/**
 * Cosa fare di un gesto al confine fra motore a step e scroll nativo (spec
 * 5.1 regola 6, task 8.21).
 *
 * Si esce solo **da fermi** allo step finale: a corsa in atto il gesto nello
 * stesso verso lo ignora già `Progress.request`, e uscire a metà lascerebbe
 * la scena congelata in un fotogramma intermedio. Da sbloccati il motore
 * tace, tranne quando la pagina è tutta su e il gesto chiede di salire
 * ancora: lì si riaggancia allo step finale.
 */
export function edgeAction(s: EdgeState): EdgeAction {
  if (s.sbloccato) return s.dir < 0 && s.scrollY <= 0 ? "riaggancia" : "nativo";
  if (s.dir > 0 && s.target === s.last && !s.moving) {
    return s.haSotto ? "sblocca" : "rimbalzo";
  }
  return "step";
}

/**
 * Chi possiede lo scroll della pagina. Il DOM (classe sull'`<html>`,
 * `scrollBy`) sta in `hooks/useHeroLock.ts`, non qui.
 */
export interface ScrollHost {
  sbloccato(): boolean;
  haSotto(): boolean;
  /** restituisce lo scroll alla pagina e la fa già scendere di `px` */
  sblocca(px: number): void;
  riaggancia(): void;
}

export class StepController {
  private wheel = new WheelGesture();
  private touchY = 0;
  private touchX = 0;
  private touchT = 0;
  private progress: Progress;
  private root: HTMLElement;
  private host: ScrollHost;

  constructor(progress: Progress, root: HTMLElement, host: ScrollHost) {
    this.progress = progress;
    this.root = root;
    this.host = host;
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

  private edge(dir: number): EdgeAction {
    return edgeAction({
      target: this.progress.target,
      last: this.progress.last,
      moving: this.progress.moving,
      dir,
      haSotto: this.host.haSotto(),
      sbloccato: this.host.sbloccato(),
      scrollY: window.scrollY,
    });
  }

  private onWheel = (e: WheelEvent) => {
    const vh = window.innerHeight;
    // il gesto si segue anche da sbloccati: al riaggancio serve sapere che la
    // coda in arrivo è inerzia dello stesso gesto, non un gesto nuovo
    const dir = this.wheel.feed(e.deltaY, e.deltaMode, performance.now(), vh);
    if (this.host.sbloccato()) {
      // da sbloccati conta il verso del singolo evento, non lo scatto: la
      // pagina deve riagganciarsi appena tocca la cima
      if (this.edge(Math.sign(e.deltaY)) !== "riaggancia") return;
      e.preventDefault();
      this.wheel.consume();
      this.host.riaggancia();
      return;
    }
    e.preventDefault();
    if (this.edge(dir) === "sblocca") {
      // `scrollBy` invece di lasciar passare l'evento: lo scroll da rotella lo
      // decide il compositore, che non ha ancora visto sparire l'`overflow:
      // hidden`, e il primo evento andrebbe perso. Il resto della spinta
      // arriva a pagina sbloccata e scorre nativo
      this.host.sblocca(wheelPx(e.deltaY, e.deltaMode, vh));
    } else {
      this.step(dir);
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    this.touchY = e.touches[0]?.clientY ?? 0;
    this.touchX = e.touches[0]?.clientX ?? 0;
    this.touchT = performance.now();
  };

  // il dito non deve trascinare la pagina: dentro l'esperienza il movimento
  // verticale è nostro, finché non è stato restituito alla pagina
  private onTouchMove = (e: TouchEvent) => {
    if (!this.host.sbloccato()) e.preventDefault();
  };

  private onTouchEnd = (e: TouchEvent) => {
    const y = e.changedTouches[0]?.clientY ?? this.touchY;
    const x = e.changedTouches[0]?.clientX ?? this.touchX;
    const dir = swipeDirection(
      y - this.touchY,
      performance.now() - this.touchT,
      x - this.touchX,
    );
    const action = this.edge(dir);
    // il dito è già alzato, non c'è inerzia nativa da lasciar partire: la
    // pagina scende di quanto si è mosso il dito
    if (action === "sblocca") this.host.sblocca(this.touchY - y);
    else if (action === "riaggancia") this.host.riaggancia();
    else if (action !== "nativo") this.step(dir);
  };

  private onKey = (e: KeyboardEvent) => {
    if (keyBelongsToFocus(e.key, focusKind(e.target))) return;
    const intent = keyIntent(e.key, e.shiftKey);
    if (!intent) return;
    const action = this.edge("dir" in intent ? intent.dir : 0);
    // sbloccata, la tastiera torna alla pagina. Allo sblocco l'evento passa
    // com'è: lo scroll da tastiera lo fa il thread principale dopo l'evento,
    // quando l'`overflow: hidden` è già sparito
    if (action === "nativo") return;
    if (action === "sblocca") {
      this.host.sblocca(0);
      return;
    }
    e.preventDefault();
    if (action === "riaggancia") {
      this.host.riaggancia();
    } else if ("to" in intent) {
      this.progress.goTo(intent.to === "first" ? 0 : this.progress.last);
    } else {
      this.step(intent.dir);
    }
  };
}

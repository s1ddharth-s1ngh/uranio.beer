// Chi possiede lo scroll della home.
//
// In cima il hero, la prima sezione, com'è sempre stata; sotto l'esperienza a
// step, la seconda; poi la pagina nativa, da "Chi siamo" in giù. Fra hero ed
// esperienza non si scorre liberamente: un gesto verso il basso fa partire il
// passaggio, uno scroll animato fino alla cima dell'esperienza, e lì il
// motore a step prende la pagina. Scorrendo a mano ci si fermerebbe a metà fra
// due scene, con l'esperienza visibile ma ancora muta. Le dissolvenze sono
// quelle di sempre del hero (`lib/heroTransition.ts`, funzioni dello scroll):
// qui si guida solo lo scroll, il resto segue da sé.
//
// Senza dipendenze, nel bundle principale con la home. L'esperienza (chunk
// lazy) lo riceve come `ScrollHost`: gli chiede di sbloccare la pagina dal
// finale, di riagganciarla, di tornare al hero dallo step 0.

import { PASSAGE, SCROLL } from "../config/theme.ts";
import type { ScrollHost } from "../core/StepController.ts";

export type PageState = "hero" | "passaggio" | "esperienza" | "pagina";

/** blocca lo scroll nativo: la stessa classe del hero su touch (index.css) */
const LOCK = "scroll-locked";

/** La curva dello scroll animato del hero (easeInOutCubic). */
export function passageEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type SyncAction = PageState | "scendi" | "sali" | "riaggancia";

/**
 * La pagina si è mossa senza il passaggio (barra di scorrimento, posizione
 * ripristinata al ricaricamento, Home/Fine nella pagina sbloccata, "trova"):
 * in che stato è adesso, o dove va portata. `top` è la cima dell'esperienza,
 * `interattiva` dice se il motore a step c'è (senza WebGL non c'è).
 */
export function syncAction(
  y: number,
  top: number,
  from: PageState,
  interattiva: boolean,
): SyncAction {
  if (y <= 1) return "hero";
  if (y > top + 1) return "pagina";
  // agganciata. Da "pagina" però ci si riaggancia solo col gesto, che decide
  // il motore: subito dopo lo sblocco dal finale la pagina è ancora qui, a
  // meno di un pixel, e la si ribloccherebbe sotto il dito
  if (y >= top - 1) return from === "pagina" || !interattiva ? "pagina" : "esperienza";
  // a metà fra hero ed esperienza non ci si ferma
  if (from === "pagina") return interattiva ? "riaggancia" : "sali";
  return "scendi";
}

/** Verso di un tasto di scroll: +1 giù, −1 su, 0 non è suo. */
function keyDir(e: KeyboardEvent): number {
  const t = e.target;
  if (t instanceof HTMLElement) {
    // un campo di testo si tiene tutti i tasti; un bottone o un link lo
    // spazio e l'invio, che lo premono
    if (t.isContentEditable || t.closest("input, textarea, select")) return 0;
    const controllo = t.closest("button, a[href], [role=button], summary");
    if (controllo && (e.key === " " || e.key === "Enter")) return 0;
  }
  switch (e.key) {
    case "ArrowDown":
    case "PageDown":
      return 1;
    case "ArrowUp":
    case "PageUp":
      return -1;
    case " ":
      return e.shiftKey ? -1 : 1;
    default:
      // Home e Fine restano al browser: nel hero portano in fondo alla
      // pagina com'è sempre stato, e lo stato lo ritrova `syncAction`
      return 0;
  }
}

interface PageScrollOptions {
  /** movimento ridotto: il passaggio diventa un salto */
  reduced: () => boolean;
}

export class PageScroll implements ScrollHost {
  private stato: PageState = "hero";
  private touch = false;
  private interattiva = false;
  private hero: HTMLElement | null = null;
  private exp: HTMLElement | null = null;
  private anim = 0;
  /** verso del passaggio in corso: +1 verso l'esperienza, −1 verso il hero */
  private verso = 0;
  /**
   * La coda d'inerzia del gesto che ha fatto il passaggio è ancora della
   * home: arrivata nell'esperienza, il motore la leggerebbe come un gesto
   * nuovo e farebbe uno step che nessuno ha chiesto.
   */
  private coda = false;
  private ultimoWheel = 0;
  private subs = new Set<() => void>();
  private ritorni = new Set<() => void>();
  private opts: PageScrollOptions;

  constructor(opts: PageScrollOptions) {
    this.opts = opts;
  }

  // --- per React (`useSyncExternalStore`)

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };

  getStato = (): PageState => this.stato;

  /** Di ritorno al hero dal basso: su touch la home mostra l'avviso del blocco. */
  onHero(fn: () => void): () => void {
    this.ritorni.add(fn);
    return () => this.ritorni.delete(fn);
  }

  /** Aggancia la home. Restituisce il distacco, per il cleanup dell'effetto. */
  attach(hero: HTMLElement, exp: HTMLElement): () => void {
    this.hero = hero;
    this.exp = exp;
    // in cattura: la home decide prima del motore a step, che ascolta la
    // rotella sull'esperienza e la tastiera su `window`, in bolla
    window.addEventListener("wheel", this.onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", this.onKey, { capture: true });
    window.addEventListener("scroll", this.onScroll, { passive: true });
    // `#step-N` nell'URL: si entra direttamente nell'esperienza
    if (/^#step-\d+$/.test(location.hash) && window.scrollY < this.top() - 1) {
      window.scrollTo(0, this.top());
    }
    this.onScroll();
    this.applyLock();
    return () => {
      window.removeEventListener("wheel", this.onWheel, { capture: true });
      window.removeEventListener("keydown", this.onKey, { capture: true });
      window.removeEventListener("scroll", this.onScroll);
      cancelAnimationFrame(this.anim);
      this.anim = 0;
      this.hero = this.exp = null;
      document.documentElement.classList.remove(LOCK);
    };
  }

  /** su touch il hero blocca lo scroll: il dito serve a spingere il logo */
  setTouch(touch: boolean) {
    this.touch = touch;
    this.applyLock();
  }

  /** Il motore a step c'è (o non c'è più): lo dice l'esperienza montando. */
  setInterattiva(v: boolean) {
    this.interattiva = v;
    const agganciata = Math.abs(window.scrollY - this.top()) < 1;
    if (v && this.stato === "pagina" && agganciata) this.set("esperienza");
    if (!v && this.stato === "esperienza") this.set("pagina");
  }

  /** Il passaggio in avanti: dal hero alla cima dell'esperienza. */
  scendi() {
    this.corri(this.top(), 1);
  }

  // --- ScrollHost, per il motore a step

  attivo() {
    return this.stato === "esperienza" || this.stato === "pagina";
  }

  sbloccato() {
    return this.stato === "pagina";
  }

  haSotto() {
    const el = this.exp;
    if (!el) return false;
    const fondo = el.getBoundingClientRect().bottom + window.scrollY;
    return fondo < document.documentElement.scrollHeight - 1;
  }

  haSopra() {
    return this.hero !== null;
  }

  top() {
    const el = this.exp;
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  }

  sblocca(px: number) {
    this.set("pagina");
    if (px) window.scrollBy({ top: px, behavior: "smooth" });
  }

  riaggancia() {
    // quando a riagganciare è la posizione (lo scroll nativo ha superato la
    // cima) il motore non ha visto il gesto: la sua coda va mangiata qui
    this.coda = true;
    this.set("esperienza");
    window.scrollTo(0, this.top());
  }

  esci() {
    this.corri(0, -1);
  }

  // --- interni

  private corri(to: number, verso: number) {
    cancelAnimationFrame(this.anim);
    this.verso = verso;
    this.set("passaggio");
    const from = window.scrollY;
    // a metà strada (inversione) il passaggio dura in proporzione
    const tutto = Math.max(1, this.top());
    const ms = this.opts.reduced()
      ? 0
      : PASSAGE.durationMs * Math.min(1, Math.abs(to - from) / tutto);
    const t0 = performance.now();
    const frame = (now: number) => {
      const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      window.scrollTo(0, from + (to - from) * passageEase(k));
      if (k < 1) {
        this.anim = requestAnimationFrame(frame);
        return;
      }
      this.anim = 0;
      this.arriva(verso);
    };
    this.anim = requestAnimationFrame(frame);
  }

  private arriva(verso: number) {
    this.coda = true;
    if (verso > 0) {
      this.set(this.interattiva ? "esperienza" : "pagina");
      return;
    }
    this.set("hero");
    for (const fn of this.ritorni) fn();
  }

  private set(s: PageState) {
    if (s === this.stato) return;
    this.stato = s;
    // tornati in cima, `#step-N` nell'URL al prossimo caricamento
    // riporterebbe nell'esperienza invece che nel hero
    if (s === "hero" && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    this.applyLock();
    for (const fn of this.subs) fn();
  }

  private applyLock() {
    const s = this.stato;
    const lock =
      s === "passaggio" || s === "esperienza" || (s === "hero" && this.touch);
    document.documentElement.classList.toggle(LOCK, lock);
  }

  private inverti() {
    if (this.verso > 0) this.esci();
    else this.scendi();
  }

  private mangia(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  private onWheel = (e: WheelEvent) => {
    const now = performance.now();
    const pausa = now - this.ultimoWheel;
    this.ultimoWheel = now;
    if (this.coda) {
      if (pausa < SCROLL.newGestureMs) {
        this.mangia(e);
        return;
      }
      this.coda = false;
    }
    if (this.stato === "hero") {
      // in cima, verso l'alto non c'è niente
      if (e.deltaY <= 0) return;
      this.mangia(e);
      this.scendi();
    } else if (this.stato === "passaggio") {
      this.mangia(e);
      // un gesto nel verso opposto inverte la corsa, come fra gli step
      if (Math.sign(e.deltaY) === -this.verso) this.inverti();
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.stato !== "hero" && this.stato !== "passaggio") return;
    const dir = keyDir(e);
    if (dir === 0) return;
    if (this.stato === "hero") {
      if (dir < 0) return;
      this.mangia(e);
      this.scendi();
      return;
    }
    this.mangia(e);
    if (dir === -this.verso) this.inverti();
  };

  private onScroll = () => {
    // è il passaggio a muovere la pagina
    if (this.anim) return;
    const a = syncAction(window.scrollY, this.top(), this.stato, this.interattiva);
    if (a === "scendi") this.scendi();
    else if (a === "sali") this.esci();
    else if (a === "riaggancia") this.riaggancia();
    else this.set(a);
  };
}

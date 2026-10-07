// Dimensioni, DPR e breakpoint, in un posto solo (spec 4.1).
//
// Il DPR va limitato: su un portatile retina `devicePixelRatio` è 2 e su certi
// Android 3, e renderizzare una scena con vetro e bloom a 3× costa il triplo
// per una differenza che non si vede. Il tetto è 1,75 su desktop e 1,5 su
// mobile; il DPR adattivo (task 8.27) scenderà ancora da qui.

/** sotto questa larghezza valgono i keyframe mobile (spec 8.5) */
export const MOBILE_MAX_WIDTH = 768;

export const DPR_CAP = { desktop: 1.75, mobile: 1.5 } as const;

/** attesa prima di ricalcolare: il resize arriva a raffica (spec 8.5) */
export const RESIZE_DEBOUNCE_MS = 100;

export interface ViewportState {
  width: number;
  height: number;
  /** già limitato: è il valore da dare al renderer, non quello del device */
  dpr: number;
  mobile: boolean;
  /** rapporto larghezza/altezza, serve a `solvePivot` (task 8.7) */
  aspect: number;
}

/**
 * La parte con la logica, separata dagli ascoltatori così si prova in Node
 * (`npm run verify:core`) senza finta di un `window`.
 */
export function computeViewport(
  width: number,
  height: number,
  devicePixelRatio: number,
): ViewportState {
  const mobile = width < MOBILE_MAX_WIDTH;
  const cap = mobile ? DPR_CAP.mobile : DPR_CAP.desktop;
  return {
    width,
    height,
    // `max(1, …)`: su un monitor con DPR dichiarato sotto 1 (zoom del browser)
    // scendere sotto il pixel reale sfoca per niente
    dpr: Math.max(1, Math.min(devicePixelRatio, cap)),
    mobile,
    aspect: height > 0 ? width / height : 1,
  };
}

/**
 * Misura la finestra e avvisa chi è iscritto quando cambia davvero. Usa
 * `visualViewport` dove c'è: su iOS è l'unico che tiene conto delle barre del
 * browser che entrano e escono, e `innerHeight` da solo fa saltare il layout
 * di 60 px quando compare la barra degli indirizzi.
 */
export class Viewport {
  state: ViewportState;
  private subs = new Set<(s: ViewportState) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.state = this.measure();
    window.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
  }

  subscribe(fn: (s: ViewportState) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  destroy() {
    clearTimeout(this.timer);
    window.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.subs.clear();
  }

  private measure(): ViewportState {
    const vv = window.visualViewport;
    return computeViewport(
      vv?.width ?? window.innerWidth,
      vv?.height ?? window.innerHeight,
      window.devicePixelRatio,
    );
  }

  private onResize = () => {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const next = this.measure();
      // il resize scatta anche per cambi che non ci riguardano (la barra di
      // iOS che si nasconde di 1 px): senza questo confronto si ricalcolano
      // tutti i keyframe per niente
      if (
        next.width === this.state.width &&
        next.height === this.state.height &&
        next.dpr === this.state.dpr
      ) {
        return;
      }
      this.state = next;
      for (const fn of this.subs) fn(next);
    }, RESIZE_DEBOUNCE_MS);
  };
}

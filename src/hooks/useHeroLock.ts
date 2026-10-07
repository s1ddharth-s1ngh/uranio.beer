import { useEffect, useRef, useState, type RefObject } from "react";
import { SCROLL } from "../config/theme";
import type { ScrollHost } from "../core/StepController";
import { setTickerAwake } from "../core/Ticker";

/**
 * La stessa classe del vecchio blocco dell'hero (index.css): toglie barre e
 * rimbalzo elastico, che dentro l'esperienza sembrerebbero un difetto.
 */
const LOCK = "scroll-locked";

// l'IntersectionObserver può riportare 0,8999 attraversando la soglia 0,9
const RATIO_EPS = 0.01;

/**
 * Chi possiede lo scroll della pagina (task 8.21): l'esperienza a step finché
 * non si esce dal finale, poi la pagina nativa fino al riaggancio. La
 * decisione è di `edgeAction` in `core/StepController.ts`; qui c'è solo il
 * DOM che la esegue.
 *
 * Fa anche da sentinella: con l'esperienza fuori vista il ticker dorme, e
 * `onHudChange` dice a `Home` quale header mostrare.
 */
export function useHeroLock(
  root: RefObject<HTMLElement | null>,
  onHudChange?: (visible: boolean) => void,
): ScrollHost {
  // un oggetto solo per tutta la vita del componente: il controller lo tiene
  // e lo interroga a ogni evento, lo stato vive nella sua chiusura
  const [host] = useState<ScrollHost>(() => {
    // ricaricando a pagina scrollata (l'hash resta `#step-6`) il browser
    // ripristina la posizione: bloccare lì intrappolerebbe l'utente a metà
    let sbloccato = window.scrollY > 0;
    return {
      sbloccato: () => sbloccato,
      haSotto: () => {
        const el = root.current;
        if (!el) return false;
        const fondo = el.getBoundingClientRect().bottom + window.scrollY;
        return fondo < document.documentElement.scrollHeight - 1;
      },
      sblocca(px) {
        sbloccato = true;
        document.documentElement.classList.remove(LOCK);
        if (px) window.scrollBy({ top: px, behavior: "smooth" });
      },
      riaggancia() {
        sbloccato = false;
        document.documentElement.classList.add(LOCK);
        // il rimbalzo elastico di Safari lascia `scrollY` negativo
        window.scrollTo(0, 0);
      },
    };
  });

  // il cleanup toglie sempre: anche partiti sbloccati, un riaggancio può
  // averla rimessa, e uscendo dalla pagina resterebbe bloccata
  useEffect(() => {
    const html = document.documentElement;
    if (!host.sbloccato()) html.classList.add(LOCK);
    return () => html.classList.remove(LOCK);
  }, [host]);

  // in un ref, così cambiare la callback non rifà l'osservatore
  const hudRef = useRef(onHudChange);
  useEffect(() => {
    hudRef.current = onHudChange;
  }, [onHudChange]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        // scrollata via, l'esperienza è ferma allo step finale: si esce
        // solo da fermi, quindi nessun tween di `p` resta a metà
        setTickerAwake(e.isIntersecting);
        hudRef.current?.(e.intersectionRatio >= SCROLL.hudVisibleRatio - RATIO_EPS);
      },
      { threshold: [0, SCROLL.hudVisibleRatio] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setTickerAwake(true);
    };
  }, [root]);

  return host;
}

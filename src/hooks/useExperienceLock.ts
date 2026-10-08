import { useEffect, useRef, useState, type RefObject } from "react";
import { PASSAGE, SCROLL } from "../config/theme";
import { onTick, setTickerAwake } from "../core/Ticker";
import { isSceneReady } from "../lib/assetProgress";
import type { PageScroll } from "../lib/pageScroll";

// l'IntersectionObserver può riportare 0,8999 attraversando la soglia 0,9
const RATIO_EPS = 0.01;

/** l'ingresso dell'esperienza (task 8.22): fermo finché non ci si arriva */
export type Reveal = "wait" | "play";

/**
 * L'esperienza dentro la home, seconda sezione dopo il hero. Lo scroll lo
 * comanda `lib/pageScroll.ts`; qui c'è quello che dipende da quanto
 * l'esperienza è in vista:
 *
 * - il ticker, l'unico loop della scena, dorme quando l'esperienza non si
 *   vede: scrollata via, o nel hero, dove sta sotto di `HERO_OVERLAP` ma
 *   coperta. Mai prima che la scena sia pronta: il Loader aspetta un suo frame
 *   disegnato (task 8.22);
 * - `onHudChange` dice alla home quale header mostrare;
 * - l'ingresso parte quando, arrivando dal hero, l'esperienza è in vista per
 *   `PASSAGE.introRatio`: è l'ultimo tratto del passaggio.
 */
export function useExperienceLock(
  root: RefObject<HTMLElement | null>,
  page: PageScroll,
  onHudChange?: (visible: boolean) => void,
): Reveal {
  const [reveal, setReveal] = useState<Reveal>("wait");

  // in un ref, così cambiare la callback non rifà l'osservatore
  const hudRef = useRef(onHudChange);
  useEffect(() => {
    hudRef.current = onHudChange;
  }, [onHudChange]);

  // il motore a step c'è: arrivando, la home può agganciare la pagina
  useEffect(() => {
    page.setInterattiva(true);
    return () => page.setInterattiva(false);
  }, [page]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let inVista = false;
    let sveglio: boolean | undefined;
    const aggiorna = () => {
      const vuole = !isSceneReady() || (inVista && page.getStato() !== "hero");
      if (vuole === sveglio) return;
      sveglio = vuole;
      setTickerAwake(vuole);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        inVista = e.isIntersecting;
        hudRef.current?.(e.intersectionRatio >= SCROLL.hudVisibleRatio - RATIO_EPS);
        if (
          page.getStato() !== "hero" &&
          e.intersectionRatio >= PASSAGE.introRatio - RATIO_EPS
        ) {
          setReveal("play");
        }
        aggiorna();
      },
      { threshold: [0, PASSAGE.introRatio, SCROLL.hudVisibleRatio] },
    );
    io.observe(el);
    // il passaggio parte dal hero, dove il ticker dorme: va svegliato prima
    // che l'esperienza entri in vista
    const stopStato = page.subscribe(aggiorna);
    // la scena diventa pronta senza che cambi niente in vista: nel hero è il
    // ticker stesso ad accorgersene e ad addormentarsi
    const stopTick = onTick(aggiorna);
    return () => {
      io.disconnect();
      stopStato();
      stopTick();
      setTickerAwake(true);
    };
  }, [root, page]);

  return reveal;
}

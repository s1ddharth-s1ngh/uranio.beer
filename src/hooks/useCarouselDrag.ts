import { useEffect, type RefObject } from "react";
import { sharedCarousel } from "../core/Carousel.ts";
import { sharedProgress } from "../core/Progress.ts";
import { onTick } from "../core/Ticker.ts";

/** oltre questo `p` il carosello non c'è più: il trascinamento si spegne */
const HERO_MAX_P = 0.5;

/** px da superare prima di decidere se il gesto è del carosello o dello step */
const SOGLIA_PX = 6;

export interface DragClasses {
  /** cursore "si può prendere" */
  grab: string;
  /** cursore "sto trascinando" */
  grabbing: string;
}

/**
 * Il trascinamento del carosello (spec 6.6), solo dentro l'hero.
 *
 * Convive con `StepController`, che sullo stesso elemento ascolta rotella e
 * swipe verticali. La regola per non pestarsi i piedi è una sola: **vince
 * l'asse del primo movimento**. Finché il dito non ha fatto 6 px non si
 * decide niente; se poi il movimento è più orizzontale che verticale il gesto
 * è del carosello, altrimenti lo si lascia perdere e sarà `touchend` a farne
 * uno step (che a sua volta ignora i gesti orizzontali).
 */
export function useCarouselDrag(
  root: RefObject<HTMLElement | null>,
  classes: DragClasses,
) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const progress = sharedProgress();
    const carousel = sharedCarousel();

    let pointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let orizzontale = false;
    const nellHero = () => progress.p < HERO_MAX_P;

    const onDown = (e: PointerEvent) => {
      if (!nellHero() || pointer !== null) return;
      pointer = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      orizzontale = false;
    };

    const onMove = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (!orizzontale) {
        if (Math.abs(dx) < SOGLIA_PX && Math.abs(dy) < SOGLIA_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          // gesto verticale: è dello StepController, qui non si fa nulla
          pointer = null;
          return;
        }
        orizzontale = true;
        carousel.grab(performance.now());
        el.classList.add(classes.grabbing);
        // la cattura serve perché il dito può uscire dall'elemento (o passare
        // sopra il canvas) senza che il trascinamento si interrompa
        el.setPointerCapture(e.pointerId);
      }
      carousel.drag(dx, performance.now());
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return;
      if (orizzontale) carousel.release();
      el.classList.remove(classes.grabbing);
      pointer = null;
      orizzontale = false;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    // il cursore "grab" vale solo dove si può trascinare. Si confronta con lo
    // stato precedente perché scrivere una classe a ogni frame, anche identica,
    // è lavoro per il browser che non serve a nessuno
    let afferrabile = false;
    const stopTick = onTick(() => {
      const ok = nellHero();
      if (ok === afferrabile) return;
      afferrabile = ok;
      el.classList.toggle(classes.grab, ok);
    });

    return () => {
      stopTick();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.classList.remove(classes.grab, classes.grabbing);
      carousel.dispose();
    };
  }, [root, classes]);
}

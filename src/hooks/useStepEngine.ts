import { useEffect, useRef, useState, type RefObject } from "react";
import { sharedProgress, type StepEnterDetail, type StepLeaveDetail } from "../core/Progress";
import { StepController } from "../core/StepController";
import { onTick } from "../core/Ticker";
import { registerDebug } from "../debug/registry";
import { LAST_STEP } from "../config/theme";
import { prefersReducedMotion } from "./usePrefersReducedMotion";

/** Lo step scritto nell'URL, se valido (spec 5.1 regola 8). */
export function stepFromHash(hash = window.location.hash): number | null {
  const m = /^#step-(\d+)$/.exec(hash);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= LAST_STEP ? n : null;
}

/**
 * Monta il motore di scroll sul contenitore dell'esperienza.
 *
 * Restituisce lo step di **destinazione**, non quello raggiunto: i testi e le
 * icone cambiano appena parte la transizione, non quando finisce (spec 4.4).
 * Il valore continuo `p` non passa da React — lo leggono i moduli GL nel tick
 * condiviso: farne uno stato farebbe 60 render al secondo.
 */
export function useStepEngine(root: RefObject<HTMLElement | null>) {
  const progress = sharedProgress({
    start: stepFromHash() ?? 0,
    reducedMotion: prefersReducedMotion,
  });
  const [step, setStep] = useState(progress.target);
  // `useRef` e non `useState`: il pannello di debug legge questo oggetto a
  // ogni frame, e un render per frame è esattamente ciò che si vuole evitare
  const spia = useRef({ p: progress.p, target: progress.target, moving: false });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const controller = new StepController(progress, el);

    const onLeave = (e: Event) => {
      setStep((e as CustomEvent<StepLeaveDetail>).detail.to);
    };
    const onEnter = (e: Event) => {
      const { step: s } = (e as CustomEvent<StepEnterDetail>).detail;
      // `replaceState` e non `pushState`: lo scroll non deve riempire la
      // cronologia, il tasto indietro del browser deve uscire dal sito
      history.replaceState(null, "", `#step-${s}`);
    };
    progress.addEventListener("step:leave", onLeave);
    progress.addEventListener("step:enter", onEnter);

    const stopTick = onTick(() => {
      spia.current.p = Number(progress.p.toFixed(3));
      spia.current.target = progress.target;
      spia.current.moving = progress.moving;
    });
    const stopDebug = registerDebug({
      title: "progress",
      target: spia.current,
      knobs: { p: { readonly: true }, target: { readonly: true }, moving: { readonly: true } },
      open: true,
    });

    return () => {
      stopDebug();
      stopTick();
      progress.removeEventListener("step:leave", onLeave);
      progress.removeEventListener("step:enter", onEnter);
      controller.dispose();
    };
  }, [progress, root]);

  return { progress, step };
}

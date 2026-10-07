import { useEffect, useRef } from "react";
import { LAST_STEP } from "../config/theme.ts";
import { STEPS } from "../content/steps.it";
import { durationFor, sharedProgress, type StepLeaveDetail } from "../core/Progress.ts";
import { useFontsReady } from "../hooks/useFontsReady";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { StepText } from "./StepText.ts";

/**
 * Il testo che si vede a uno step: solo dall'1 al 5.
 *
 * Nell'hero il titolo sta sul piedistallo (task 8.19) e nel finale è la
 * scritta gigante (task 8.20): il blocco a sinistra è dei soli step
 * raccontati (spec 7.5).
 */
const testoPer = (step: number) =>
  step >= 1 && step < LAST_STEP ? STEPS[step] : null;

/**
 * Lo strato dei testi degli step.
 *
 * Il componente è solo il contenitore: le animazioni le guida la classe
 * `StepText`, che reagisce a `step:leave` — cioè alla **partenza** della
 * transizione, non al suo arrivo. È quello che fa uscire il testo vecchio
 * insieme al movimento della bottiglia invece che dopo.
 */
export function StepTextLayer({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  // `SplitText` misura le righe nel momento in cui gira: farlo prima che i
  // font siano pronti significa righe spezzate dove capita, e spezzate
  // restano anche dopo lo swap del font (spec 8.3)
  const fontsReady = useFontsReady();

  useEffect(() => {
    const el = host.current;
    if (!fontsReady || !el) return;
    const reduced = prefersReducedMotion();
    const progress = sharedProgress();
    const testo = new StepText(el, reduced);
    // all'avvio si parte dallo step corrente, che con `#step-3` nell'URL può
    // non essere lo zero
    testo.show(testoPer(progress.target), 0);

    const onLeave = (e: Event) => {
      const { from, to } = (e as CustomEvent<StepLeaveDetail>).detail;
      testo.show(testoPer(to), durationFor(from, to, reduced));
    };
    progress.addEventListener("step:leave", onLeave);
    return () => {
      progress.removeEventListener("step:leave", onLeave);
      testo.dispose();
    };
  }, [fontsReady]);

  return <div ref={host} className={className} />;
}

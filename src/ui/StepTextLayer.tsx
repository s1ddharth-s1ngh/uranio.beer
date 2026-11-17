import { useEffect, useRef } from "react";
import { STEPS } from "../content/steps.it";
import { durationFor, sharedProgress, type StepLeaveDetail } from "../core/Progress.ts";
import { useFontsReady } from "../hooks/useFontsReady";
import { sharedViewport } from "../hooks/useViewport";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { StepText } from "./StepText.ts";

/**
 * Il testo che si vede a uno step: quello degli step che hanno un
 * paragrafo da raccontare, il fronte e le quattro fasce.
 *
 * Nell'anello parlano le etichette e l'invito a scorrere (`HeroUi`), nella
 * gamma la fila di bottiglie e nel finale c'è la scritta gigante (task
 * 8.20): il blocco a sinistra è dei soli step raccontati (spec 7.5). Il
 * fronte ci sta insieme al retro perché passando allo step 2 il testo
 * cambi con la stessa animazione, senza spostarsi.
 */
const testoPer = (step: number) => (STEPS[step]?.body ? STEPS[step] : null);
const CON_TESTO = STEPS.filter((s) => s.body);

/**
 * I font dei blocchi, chiesti a mano. `fonts.ready` aspetta solo i font già
 * richiesti, e il browser ne chiede uno quando del testo visibile lo usa: i
 * blocchi si spezzano in anticipo e nascosti, e senza questo il serif dei
 * titoli non era ancora arrivato. Le righe si misuravano sul font di ripiego,
 * più largo, e "Crisi Economica" andava a capo (visto il 2026-11-17).
 */
function caricaFont(): Promise<unknown> {
  const cs = getComputedStyle(document.documentElement);
  return Promise.all([
    document.fonts.load(`400 64px ${cs.getPropertyValue("--u-font-display")}`),
    document.fonts.load(`300 16px ${cs.getPropertyValue("--u-font-body")}`),
  ]).catch(() => undefined);
}

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
    const onLeave = (e: Event) => {
      const { from, to } = (e as CustomEvent<StepLeaveDetail>).detail;
      testo.show(testoPer(to), durationFor(from, to, reduced));
    };
    let vivo = true;
    let stopVp = () => {};
    caricaFont().then(() => {
      if (!vivo) return;
      // tutti i blocchi subito, sotto il Loader: al cambio di step resta da
      // creare solo l'animazione (vedi `StepText`). A ogni resize le righe
      // si rimisurano, sui blocchi che non sono in scena
      testo.prepara(CON_TESTO);
      stopVp = sharedViewport().subscribe(() => {
        testo.rifai();
        testo.prepara(CON_TESTO);
      });
      // all'avvio si parte dallo step corrente, che con `#step-3` nell'URL
      // può non essere lo zero
      testo.show(testoPer(progress.target), 0);
      progress.addEventListener("step:leave", onLeave);
    });
    return () => {
      vivo = false;
      progress.removeEventListener("step:leave", onLeave);
      stopVp();
      testo.dispose();
    };
  }, [fontsReady]);

  return <div ref={host} className={className} />;
}

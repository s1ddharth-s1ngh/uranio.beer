import { useEffect, useRef } from "react";
import { LAST_STEP } from "../config/theme.ts";
import { sharedProgress } from "../core/Progress.ts";
import { onTick } from "../core/Ticker.ts";
import styles from "./Hud.module.css";

/**
 * La barra di progresso in alto (spec 8.17): `p / 6`, letta a ogni tick.
 *
 * Non passa da React. `p` si muove 60 volte al secondo e farne uno stato
 * vorrebbe dire 60 render al secondo per cambiare una larghezza: qui si
 * scrive direttamente la variabile CSS sull'elemento. È l'unico elemento
 * dell'interfaccia che si aggiorna in continuo invece che a ogni step, perché
 * è l'unico che deve avanzare **durante** la transizione.
 */
export function ProgressBar({ step }: { step: number }) {
  const riempimento = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progress = sharedProgress();
    let ultimo = -1;
    return onTick(() => {
      const el = riempimento.current;
      if (!el) return;
      // tre decimali: oltre, si riscriverebbe lo stile per cambiamenti che
      // non spostano un pixel
      const frazione = Math.round((progress.p / LAST_STEP) * 1000) / 1000;
      if (frazione === ultimo) return;
      ultimo = frazione;
      el.style.setProperty("--fill", `${Math.max(0, frazione) * 100}%`);
    });
  }, []);

  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label="Avanzamento dell'esperienza"
      aria-valuemin={0}
      aria-valuemax={LAST_STEP}
      /* per gli screen reader il progresso è discreto: lo step di
         destinazione, non il valore continuo che cambia 60 volte al secondo */
      aria-valuenow={step}
    >
      <i className={styles.progressDotStart} aria-hidden="true" />
      <div ref={riempimento} className={styles.progressFill} aria-hidden="true">
        {/* la testa luminosa: un gradiente di 60 px che finisce nel bianco */}
        <i className={styles.progressHead} />
      </div>
      <i className={styles.progressDotEnd} aria-hidden="true" />
    </div>
  );
}

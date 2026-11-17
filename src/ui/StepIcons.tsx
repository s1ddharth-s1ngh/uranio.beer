import { STEPS } from "../content/steps.it";
import { sharedProgress } from "../core/Progress.ts";
import styles from "./Hud.module.css";

/** le quattro fasce del retro, numerate da 01 */
const VOCI = STEPS.map((s, index) => ({ ...s, index }))
  .filter((s) => s.band)
  .map((s, k) => ({ ...s, numero: String(k + 1).padStart(2, "0") }));

/** sfalsamento dell'entrata, in ms (spec 8.17) */
const STAGGER_MS = 70;

/**
 * L'indice delle fasce a destra (spec 8.17): numeri piccoli, il corrente
 * acceso e segnato da un filo, gli altri spenti. Erano icone in cerchi di
 * vetro; il nome del file è rimasto.
 *
 * È anche la navigazione: un click chiama `goTo`, che passa dagli step
 * intermedi senza fermarsi (regola 5.1.7). Resta nel DOM sempre, per gli
 * screen reader, ma fuori dal percorso di tabulazione quando non si vede —
 * un bottone invisibile ma raggiungibile col tab è una trappola.
 */
export function StepIcons({ step }: { step: number }) {
  const progress = sharedProgress();
  // solo sulle quattro fasce: nell'hero, nella gamma e nel finale esce
  const visibile = Boolean(STEPS[step]?.band);

  return (
    <div
      className={`${styles.index} ${visibile ? styles.indexIn : ""}`}
      role="group"
      aria-label="Passi dell'esperienza"
    >
      {VOCI.map((voce, k) => {
        const attivo = step === voce.index;
        return (
          <div
            key={voce.id}
            className={styles.indexSlot}
            style={{ transitionDelay: `${k * STAGGER_MS}ms` }}
          >
            <button
              type="button"
              className={`${styles.indexItem} ${attivo ? styles.indexActive : ""}`}
              // il numero visibile sta anche nel nome: chi comanda a voce
              // dice quello che vede (WCAG 2.5.3)
              aria-label={`${voce.numero} ${voce.title}`}
              aria-current={attivo ? "step" : undefined}
              tabIndex={visibile ? 0 : -1}
              onClick={() => progress.goTo(voce.index)}
            >
              <i className={styles.indexRule} aria-hidden="true" />
              <span>{voce.numero}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

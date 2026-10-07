import { LAST_STEP } from "../config/theme.ts";
import { STEPS } from "../content/steps.it";
import { sharedProgress } from "../core/Progress.ts";
import styles from "./Hud.module.css";
import { StepIcon } from "./icons";

/** gli step che hanno un'icona: le quattro fasce del retro */
const VOCI = STEPS.map((s, index) => ({ ...s, index })).filter((s) => s.icon);

/** sfalsamento dell'entrata, in ms (spec 8.17) */
const STAGGER_MS = 80;

/**
 * La colonna di icone a destra (spec 8.17).
 *
 * Sono anche la navigazione: un click chiama `goTo`, che passa dagli step
 * intermedi senza fermarsi (regola 5.1.7). Restano nel DOM sempre, per gli
 * screen reader, ma fuori dal percorso di tabulazione quando non si vedono —
 * un bottone invisibile ma raggiungibile col tab è una trappola.
 */
export function StepIcons({ step }: { step: number }) {
  const progress = sharedProgress();
  // dallo step 1 (nessuna attiva, come nel riferimento) fino all'ultima
  // fascia; nel finale escono
  const visibile = step >= 1 && step < LAST_STEP;

  return (
    <div
      className={`${styles.icons} ${visibile ? styles.iconsIn : ""}`}
      role="group"
      aria-label="Passi dell'esperienza"
    >
      {VOCI.map((voce, k) => {
        const attivo = step === voce.index;
        return (
          <div
            key={voce.id}
            className={styles.iconSlot}
            style={{ transitionDelay: `${k * STAGGER_MS}ms` }}
          >
            <button
              type="button"
              className={`${styles.icon} ${attivo ? styles.iconActive : ""}`}
              aria-label={voce.title}
              aria-current={attivo ? "step" : undefined}
              tabIndex={visibile ? 0 : -1}
              onClick={() => progress.goTo(voce.index)}
            >
              <StepIcon name={voce.icon!} />
            </button>
            {k < VOCI.length - 1 && (
              <i className={styles.iconDots} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

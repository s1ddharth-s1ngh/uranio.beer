import { useEffect } from "react";
import { STEPS } from "../content/steps.it";
import { setSceneReady } from "../lib/assetProgress";
import styles from "./Fallback.module.css";

const IMAGES = `${import.meta.env.BASE_URL}images/`;

/**
 * L'esperienza senza WebGL2, o dopo un contesto perso (task 8.24): gli stessi
 * testi a scroll normale, uno step per sezione, con l'etichetta vera al posto
 * della bottiglia. Niente blocco dello scroll e niente motore a step.
 *
 * `onHudChange(false)`: l'HUD qui non c'è, l'header lo fa la `TopBar` del
 * sito. E la scena non arriverà mai: si libera subito il Loader invece di
 * fargli aspettare il suo failsafe.
 */
export function Fallback({ onHudChange }: { onHudChange?: (visible: boolean) => void }) {
  useEffect(() => {
    onHudChange?.(false);
    setSceneReady();
  }, [onHudChange]);

  return (
    <div className={styles.page}>
      {STEPS.map((step) => (
        <section key={step.id} className={styles.step}>
          {step.image && (
            <img
              className={styles.image}
              src={IMAGES + step.image.file}
              alt={step.image.alt}
              loading="lazy"
              decoding="async"
            />
          )}
          <div className={styles.text}>
            {step.tag && (
              <p className={`${styles.tag} t-label`}>
                {step.tag.strike ? <s>{step.tag.text}</s> : step.tag.text}
              </p>
            )}
            {step.title && <h2 className="t-display">{step.title}</h2>}
            {step.bigWord && <h2 className="t-display">{step.bigWord.join(" ")}</h2>}
            {step.subtitle && <p className="t-label">{step.subtitle}</p>}
            {step.body && <p className="t-body">{step.body}</p>}
            {step.note && <p className="t-body">{step.note}</p>}
            {step.cta && (
              <p className={styles.buttons}>
                {step.cta.map((c, i) => (
                  <a key={c.href} className={i === 0 ? styles.primary : styles.secondary} href={c.href}>
                    {c.label}
                  </a>
                ))}
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

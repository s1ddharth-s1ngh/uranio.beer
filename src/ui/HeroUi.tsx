import { useSyncExternalStore, type CSSProperties } from "react";
import { HERO_UI } from "../config/text.ts";
import { STEPS } from "../content/steps.it";
import { sharedIntro } from "../core/Intro.ts";
import { durationFor, sharedProgress } from "../core/Progress.ts";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import styles from "./HeroUi.module.css";

const HERO = STEPS[0];
const LOGOTIPO = `${import.meta.env.BASE_URL}images/crisi-economica-logotipo.webp`;

/**
 * L'interfaccia dello step 0: il nome a sinistra della bottiglia inclinata,
 * come il blocco dei testi degli step (riferimento ciaoenergy.com), e
 * l'invito a scorrere in basso.
 *
 * Esiste solo allo step 0. L'entrata e l'uscita sono transizioni CSS su una
 * classe, come `StepIcons`: se la direzione si inverte a metà si fermano e
 * tornano indietro da sole, senza timeline da uccidere.
 *
 * Due involucri, due ragioni per non vedersi: il **cancello** esterno si apre
 * una volta sola, quando la bottiglia è quasi arrivata (`Intro`), senza
 * ritardo; quello interno segue lo step, con il ritardo del rientro. Con una
 * classe sola la prima entrata erediterebbe il ritardo del ritorno.
 */
export function HeroUi({ step, className }: { step: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const intro = sharedIntro();
  const aperto = useSyncExternalStore(intro.subscribe, () => intro.uiReady);
  const visibile = step === 0;

  const style = {
    "--hero-fade": `${HERO_UI.exit.duration}s`,
    "--hero-shift": `${HERO_UI.exit.y}px`,
    "--hero-return-delay": `${durationFor(1, 0, reduced) * HERO_UI.returnDelayFraction}s`,
  } as CSSProperties;

  const tab = visibile && aperto ? 0 : -1;
  const avanti = () => {
    // passa dal lock come un gesto, invece di scavalcarlo come `goTo`
    const progress = sharedProgress();
    progress.request(progress.target + 1, 1);
  };

  return (
    <div className={className} style={style}>
      <div className={`${styles.gate} ${aperto ? styles.open : ""}`}>
        <div className={`${styles.ui} ${visibile ? styles.in : ""}`}>
          <div className={styles.name}>
            <p className={`${styles.tag} t-label`}>{HERO.subtitle}</p>
            <h1 className={styles.logo}>
              <img src={LOGOTIPO} alt={HERO.title} width={546} height={261} />
            </h1>
            <p className={`${styles.body} t-body`}>{HERO.body}</p>
          </div>

          <button type="button" className={styles.hint} tabIndex={tab} onClick={avanti}>
            <span className="t-label">{HERO.scrollHint}</span>
            <i className={styles.hintLine} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

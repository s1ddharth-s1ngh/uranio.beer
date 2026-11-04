import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { HERO_UI } from "../config/text.ts";
import { STEPS } from "../content/steps.it";
import { heroLayout } from "../core/heroLayout.ts";
import { sharedIntro } from "../core/Intro.ts";
import { durationFor, sharedProgress } from "../core/Progress.ts";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useViewport } from "../hooks/useViewport";
import styles from "./HeroUi.module.css";

const ANELLO = STEPS[0];
const FRONTE = STEPS[1];
const LOGOTIPO = `${import.meta.env.BASE_URL}images/crisi-economica-logotipo.webp`;

/**
 * L'interfaccia dei primi due step (riferimento ciaoenergy.com):
 *
 * - **anello** (0): il logotipo sul piedistallo, sotto la bottiglia al
 *   centro, e l'invito a scorrere. Niente frecce né slider: la bottiglia è
 *   sempre la stessa, non c'è niente da sfogliare;
 * - **fronte** (1): il nome e due righe a sinistra della bottiglia
 *   inclinata, nella stessa colonna dei testi del retro (`StepText`), così
 *   passando allo step 2 il testo cambia senza spostarsi.
 *
 * L'entrata e l'uscita sono transizioni CSS su una classe, come `StepIcons`:
 * se la direzione si inverte a metà si fermano e tornano indietro da sole,
 * senza timeline da uccidere.
 *
 * Due involucri, due ragioni per non vedersi: il **cancello** esterno si apre
 * una volta sola, quando la bottiglia è quasi arrivata (`Intro`), senza
 * ritardo; quelli interni seguono lo step, con il ritardo del rientro. Con
 * una classe sola la prima entrata erediterebbe il ritardo del ritorno.
 */
export function HeroUi({ step, className }: { step: number; className?: string }) {
  const vp = useViewport();
  // la scena proiettata allo step 0: cambia solo col viewport, non a ogni frame
  const layout = useMemo(() => heroLayout(vp), [vp]);
  const reduced = usePrefersReducedMotion();
  const intro = sharedIntro();
  const aperto = useSyncExternalStore(intro.subscribe, () => intro.uiReady);
  const suAnello = step === 0;
  const suFronte = step === 1;

  const style = {
    "--pedestal-y": `${layout.pedestalTopY * 100}%`,
    "--name-anchor": HERO_UI.nameAnchor,
    "--hero-fade": `${HERO_UI.exit.duration}s`,
    "--hero-shift": `${HERO_UI.exit.y}px`,
    "--hero-return-delay": `${durationFor(1, 0, reduced) * HERO_UI.returnDelayFraction}s`,
  } as CSSProperties;

  const tab = suAnello && aperto ? 0 : -1;
  const avanti = () => {
    // passa dal lock come un gesto, invece di scavalcarlo come `goTo`
    const progress = sharedProgress();
    progress.request(progress.target + 1, 1);
  };

  return (
    <div className={className} style={style}>
      <div className={`${styles.gate} ${aperto ? styles.open : ""}`}>
        <div className={`${styles.ui} ${suAnello ? styles.in : ""}`} aria-hidden={!suAnello}>
          <div className={styles.pedestal}>
            <h1 className={styles.logo}>
              <img src={LOGOTIPO} alt={ANELLO.title} width={546} height={261} />
            </h1>
            <p className="t-label">{ANELLO.subtitle}</p>
          </div>

          <button type="button" className={styles.hint} tabIndex={tab} onClick={avanti}>
            <span className="t-label">{ANELLO.scrollHint}</span>
            <i className={styles.hintLine} aria-hidden="true" />
          </button>
        </div>

        <div className={`${styles.ui} ${suFronte ? styles.in : ""}`} aria-hidden={!suFronte}>
          <div className={styles.name}>
            <p className={`${styles.tag} t-label`}>{FRONTE.subtitle}</p>
            <h2 className={styles.logo}>
              <img src={LOGOTIPO} alt={FRONTE.title} width={546} height={261} />
            </h2>
            <p className={`${styles.body} t-body`}>{FRONTE.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

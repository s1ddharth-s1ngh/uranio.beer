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

/**
 * L'interfaccia dell'anello, lo step 0 (riferimento ciaoenergy.com): sotto
 * il piedistallo stile e gradazione, in basso l'invito a scorrere. Niente
 * frecce né slider: la bottiglia è sempre la stessa, non c'è niente da
 * sfogliare. E niente logotipo: il nome lo portano le etichette, e allo
 * step 1 il titolo del blocco a sinistra (`StepText`, lo stesso del retro).
 *
 * L'entrata e l'uscita sono transizioni CSS su una classe, come `StepIcons`:
 * se la direzione si inverte a metà si fermano e tornano indietro da sole,
 * senza timeline da uccidere.
 *
 * Due involucri, due ragioni per non vedersi: il **cancello** esterno si apre
 * una volta sola, quando la bottiglia è quasi arrivata (`Intro`), senza
 * ritardo; quello interno segue lo step, con il ritardo del rientro. Con
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

  const style = {
    "--pedestal-y": `${layout.pedestalTopY * 100}%`,
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
          <div className={styles.caption}>
            {/* il nome per chi non vede le etichette: h2 e non h1, l'h1
                della pagina è il titolo del hero */}
            <h2 className={styles.srOnly}>{ANELLO.title}</h2>
            <p className="t-label">{ANELLO.subtitle}</p>
          </div>

          <button type="button" className={styles.hint} tabIndex={tab} onClick={avanti}>
            <span className="t-label">{ANELLO.scrollHint}</span>
            <i className={styles.hintLine} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

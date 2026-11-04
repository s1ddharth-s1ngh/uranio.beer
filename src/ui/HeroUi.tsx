import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { HERO_UI } from "../config/text.ts";
import { STEPS } from "../content/steps.it";
import { sharedCarousel } from "../core/Carousel.ts";
import { heroLayout } from "../core/heroLayout.ts";
import { sharedIntro } from "../core/Intro.ts";
import { durationFor, sharedProgress } from "../core/Progress.ts";
import { onTick } from "../core/Ticker.ts";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useViewport } from "../hooks/useViewport";
import styles from "./HeroUi.module.css";

const HERO = STEPS[0];
const LOGOTIPO = `${import.meta.env.BASE_URL}images/crisi-economica-logotipo.webp`;

/**
 * Cinque puntini a chevron, disegnati a mano come `icons.tsx`: punta a
 * sinistra; la freccia destra è la stessa specchiata dal CSS.
 */
const PUNTI = [
  [15, 4],
  [11.5, 8],
  [8, 12],
  [11.5, 16],
  [15, 20],
] as const;

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {PUNTI.map(([cx, cy]) => (
        <circle key={cy} cx={cx} cy={cy} r={1.5} />
      ))}
    </svg>
  );
}

/**
 * L'interfaccia dell'hero (spec 8.19): il nome sul piedistallo, le frecce ai
 * lati della protagonista, lo slider e l'invito a scorrere.
 *
 * Esiste solo allo step 0. L'entrata e l'uscita sono transizioni CSS su una
 * classe, come `StepIcons`: se la direzione si inverte a metà si fermano e
 * tornano indietro da sole, senza timeline da uccidere.
 *
 * Due involucri, due ragioni per non vedersi: il **cancello** esterno si apre
 * una volta sola, a fine ingresso (task 8.22), senza ritardo; quello interno
 * segue lo step, con il ritardo del rientro. Con una classe sola la prima
 * entrata erediterebbe il ritardo pensato per il ritorno dal primo piano.
 */
export function HeroUi({ step, className }: { step: number; className?: string }) {
  const vp = useViewport();
  // la scena proiettata allo step 0: cambia solo col viewport, non a ogni frame
  const layout = useMemo(() => heroLayout(vp), [vp]);
  const reduced = usePrefersReducedMotion();
  const slider = useRef<HTMLDivElement>(null);
  const intro = sharedIntro();
  const aperto = useSyncExternalStore(intro.subscribe, () => intro.uiReady);
  const visibile = step === 0;

  // Il pallino segue l'anello a ogni tick, fuori da React: lo stesso schema di
  // `ProgressBar`, una variabile CSS riscritta solo quando cambia.
  useEffect(() => {
    const carousel = sharedCarousel();
    let ultimo = -1;
    return onTick(() => {
      const el = slider.current;
      if (!el) return;
      const ring = Math.round(carousel.ring * 1000) / 1000;
      if (ring === ultimo) return;
      ultimo = ring;
      el.style.setProperty("--ring", `${ring * 100}%`);
    });
  }, []);

  const style = {
    "--center-y": `${layout.centerY * 100}%`,
    "--pedestal-y": `${layout.pedestalTopY * 100}%`,
    "--name-anchor": HERO_UI.nameAnchor,
    "--arrow-offset": `${HERO_UI.arrowOffset}px`,
    "--hero-fade": `${HERO_UI.exit.duration}s`,
    "--hero-shift": `${HERO_UI.exit.y}px`,
    "--hero-return-delay": `${durationFor(1, 0, reduced) * HERO_UI.returnDelayFraction}s`,
  } as CSSProperties;

  const tab = visibile && aperto ? 0 : -1;
  const nudge = (dir: number) => sharedCarousel().nudge(dir);
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
            <h1 className={styles.logo}>
              {/* l'alt è il titolo della pagina: al task 8.21 il vecchio hero
                  sparisce e questo resta l'unico h1 */}
              <img src={LOGOTIPO} alt={HERO.title} width={546} height={261} />
            </h1>
            <p className="t-label">{HERO.subtitle}</p>
          </div>

          <button
            type="button"
            className={`${styles.arrow} ${styles.prev}`}
            aria-label="Bottiglia precedente"
            tabIndex={tab}
            onClick={() => nudge(-1)}
          >
            <Chevron />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Bottiglia successiva"
            tabIndex={tab}
            // `nudge(+1)` porta al centro la bottiglia che stava a destra
            onClick={() => nudge(1)}
          >
            <Chevron />
          </button>

          {/* solo indicatore: i controlli accessibili sono le frecce */}
          <div ref={slider} className={styles.slider} aria-hidden="true">
            <i className={styles.knob} />
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

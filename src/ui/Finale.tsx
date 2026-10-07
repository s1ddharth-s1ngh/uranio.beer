import { useEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { FINALE } from "../config/text.ts";
import { LAST_STEP } from "../config/theme.ts";
import { STEPS } from "../content/steps.it";
import { durationFor, sharedProgress, type StepLeaveDetail } from "../core/Progress.ts";
import { useFontsReady } from "../hooks/useFontsReady";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import styles from "./Finale.module.css";

gsap.registerPlugin(SplitText);

const FINE = STEPS[LAST_STEP];

/** la posizione delle CTA arriva al CSS dalla config, non scritta due volte */
const CTA_TOP = {
  "--cta-top": FINALE.ctaTop.desktop,
  "--cta-top-mobile": FINALE.ctaTop.mobile,
} as CSSProperties;

/**
 * Le animazioni del finale (spec 7.6 e 8.20), fuori da React come
 * `StepText`: una timeline sola per lettere e bottoni, uccisa prima di
 * partire con la nuova. È questo che rende sicura l'inversione a metà
 * (6 → 5 → 6): si riparte dallo stato in cui le lettere sono, con `to` e
 * mai con `from`.
 */
class FinaleMotion {
  private hosts: HTMLElement[];
  private split: SplitText;
  private pezzi: Element[];
  private reduced: boolean;
  private tl: gsap.core.Timeline | undefined;
  private dentro = false;

  constructor(word: HTMLElement, cta: HTMLElement, reduced: boolean) {
    this.hosts = [word, cta];
    this.reduced = reduced;
    // `aria: "auto"` (il default di SplitText 3.13+) mette `aria-label` sul
    // titolo e `aria-hidden` sulle lettere: lo screen reader legge
    // "ZERO CRISI", non dieci lettere
    this.split = SplitText.create(word.querySelector("h2"), { type: "chars" });
    this.pezzi = Array.from(cta.children);
    gsap.set(this.split.chars, this.lettere(false));
    gsap.set(this.pezzi, { opacity: 0, y: reduced ? 0 : 20 });
    this.attiva(false);
    // nascosti dal CSS finché le lettere non hanno il loro stato iniziale:
    // senza, al primo frame "ZERO CRISI" lampeggerebbe piena
    for (const h of this.hosts) h.style.visibility = "visible";
  }

  /** Entra dopo `delay` secondi, oppure esce subito. */
  show(on: boolean, delay = 0) {
    if (on === this.dentro) return;
    this.dentro = on;
    this.tl?.kill();
    const veloce = this.reduced ? FINALE.exit.duration : undefined;

    if (!on) {
      this.attiva(false);
      this.tl = gsap
        .timeline()
        .to(this.split.chars, {
          ...this.lettere(false),
          duration: FINALE.exit.duration,
          ease: FINALE.exit.ease,
        })
        .to(
          this.pezzi,
          { opacity: 0, duration: FINALE.exit.duration, ease: FINALE.exit.ease },
          0,
        );
      return;
    }

    this.tl = gsap
      .timeline({ delay })
      .to(this.split.chars, {
        ...this.lettere(true),
        duration: veloce ?? FINALE.chars.duration,
        stagger: this.reduced ? 0 : { each: FINALE.chars.stagger, from: "random" },
        ease: FINALE.chars.ease,
      })
      // i bottoni diventano raggiungibili quando cominciano a vedersi
      .call(() => this.attiva(true), undefined, `>-${FINALE.cta.overlap}`)
      .to(
        this.pezzi,
        {
          opacity: 1,
          y: 0,
          duration: veloce ?? FINALE.cta.duration,
          stagger: this.reduced ? 0 : FINALE.cta.stagger,
          ease: FINALE.cta.ease,
        },
        "<",
      );
  }

  dispose() {
    this.tl?.kill();
    this.split.revert();
  }

  /** con `prefers-reduced-motion` solo l'opacità: niente sfocato né salita */
  private lettere(visibili: boolean): gsap.TweenVars {
    const opacity = visibili ? FINALE.chars.opacity : 0;
    if (this.reduced) return { opacity };
    return visibili
      ? { opacity, filter: "blur(0px)", y: 0 }
      : { opacity, filter: "blur(12px)", y: 30 };
  }

  /**
   * Da nascosto il finale non si raggiunge col tab, non si clicca e non si
   * legge: `inert` fa le tre cose insieme.
   */
  private attiva(on: boolean) {
    for (const h of this.hosts) h.inert = !on;
  }
}

/**
 * Il finale: la scritta gigante nello strato dietro la bottiglia, riga
 * piccola e bottoni in quello davanti (spec 4.2). Due contenitori perché la
 * bottiglia sta in mezzo, una sola timeline perché escono insieme.
 */
export function Finale({
  wordClassName,
  uiClassName,
}: {
  wordClassName: string;
  uiClassName: string;
}) {
  const word = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLDivElement>(null);
  // `SplitText` misura nel momento in cui gira: prima i font (spec 8.3)
  const fontsReady = useFontsReady();

  useEffect(() => {
    const w = word.current;
    const c = cta.current;
    if (!fontsReady || !w || !c) return;
    const reduced = prefersReducedMotion();
    const progress = sharedProgress();
    const motion = new FinaleMotion(w, c, reduced);
    // con `#step-6` nell'URL si parte già nel finale
    motion.show(progress.target === LAST_STEP);

    const onLeave = (e: Event) => {
      const { to } = (e as CustomEvent<StepLeaveDetail>).detail;
      // la durata vera della corsa parte da `p`, non dallo step di partenza:
      // con un'inversione a metà resta poca strada e poco tempo
      motion.show(
        to === LAST_STEP,
        FINALE.enterAt * durationFor(progress.p, to, reduced),
      );
    };
    progress.addEventListener("step:leave", onLeave);
    return () => {
      progress.removeEventListener("step:leave", onLeave);
      motion.dispose();
    };
  }, [fontsReady]);

  return (
    <>
      <div ref={word} className={`${wordClassName} ${styles.word}`}>
        <h2 className={styles.bigWord}>
          <span>{FINE.bigWord?.[0]}</span> <span>{FINE.bigWord?.[1]}</span>
        </h2>
      </div>
      <div className={uiClassName}>
        <div ref={cta} className={styles.cta} style={CTA_TOP}>
          <p className={styles.note}>{FINE.note}</p>
          <div className={styles.buttons}>
            {FINE.cta?.map((c) => {
              const esterno = c.href.startsWith("http");
              return (
                <a
                  key={c.href}
                  href={c.href}
                  className={esterno ? styles.primary : styles.secondary}
                  target={esterno ? "_blank" : undefined}
                  rel={esterno ? "noopener noreferrer" : undefined}
                >
                  {c.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useInView } from "framer-motion";
import Loader from "../components/Loader";
import TopBar from "../components/TopBar";
import InteractiveText from "../components/InteractiveText";
import InvertCursor from "../components/InvertCursor";
import ScrollPill from "../components/ui/ScrollPill";
import HeroLock from "../components/ui/HeroLock";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useIsTouch } from "../hooks/useIsTouch";
import { HERO_OVERLAP, transitionAt } from "../lib/heroTransition";
import { PageScroll } from "../lib/pageScroll";
import FaqSection from "../components/faq/FaqSection";
import styles from "./Home.module.css";

// Le scene WebGL (three + R3F) vivono in chunk separati: la home shell e
// /coming-soon restano leggere; il Loader copre l'attesa di chunk + GLB
const HeroScene = lazy(() => import("../components/scene/HeroScene"));
// la seconda sezione, lo scroll 3D a step: three, drei e gsap, in un chunk suo
const Experience = lazy(() => import("./Experience"));
const AboutSection = lazy(() => import("../components/about/AboutSection"));

// ✏️ Testi placeholder — sostituiscili qui con i contenuti reali
const HERO_TITLE = "ATOMIC BEER";
const PILL_LABEL = "Scorri in basso";

const reducedNow = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Home() {
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const { pathname } = useLocation();

  // pausa del canvas hero quando è scrollato fuori vista
  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { margin: "200px 0px 200px 0px" });

  // TRANSIZIONE HERO → ESPERIENZA (vedi lib/heroTransition.ts). Scritta a
  // mano invece che con useScroll+useTransform di Framer: quelli si appoggiano
  // a una misurazione dell'elemento fatta in un effect, e col doppio
  // mount/unmount di StrictMode restavano agganciati a misure fantasma —
  // le due sezioni svanivano insieme a metà pagina. Qui la sorgente è
  // scrollY/innerHeight, letta al momento: niente stato, niente misure.
  // Lo scroll lo guida il passaggio (lib/pageScroll.ts), le dissolvenze sono
  // quelle di sempre.
  const nextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hero = heroRef.current;
    const next = nextRef.current;
    if (!hero || !next) return;
    if (reduceMotion) {
      hero.style.opacity = "";
      hero.style.pointerEvents = "";
      next.style.opacity = "";
      return;
    }

    let raf = 0;
    const apply = () => {
      raf = 0;
      const { hero: h, about: a } = transitionAt(
        window.scrollY,
        window.innerHeight,
      );
      hero.style.opacity = h.toFixed(4);
      // svanito = trasparente ai click: la sua ultima striscia (invisibile ma
      // sopra per z-index) ruberebbe il puntatore alla sezione 2
      hero.style.pointerEvents = h < 0.01 ? "none" : "auto";
      next.style.opacity = a.toFixed(4);
    };
    // un frame per scroll: la lettura di scrollY è sempre quella corrente,
    // quindi non si accumula ritardo nemmeno con lo scroll a raffica
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      hero.style.opacity = "";
      hero.style.pointerEvents = "";
      next.style.opacity = "";
    };
  }, [reduceMotion]);

  // Senza hover il gesto del dito non può essere insieme scroll e interazione:
  // nella prima sezione lo scroll è bloccato e il dito pilota il logo 3D, si
  // scende solo col pulsante. Risalendo, la pagina si riaggancia da sola.
  const isTouch = useIsTouch();
  // l'avviso compare solo tornando indietro: al primo caricamento la freccia
  // parla da sola, spiegare il blocco prima che l'utente ci sbatta è rumore
  const [hint, setHint] = useState(false);
  const hintTimer = useRef(0);
  const onRelock = useCallback(() => {
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 4200);
  }, []);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  // Chi possiede lo scroll: il hero, il passaggio animato, l'esperienza a
  // step, la pagina nativa (lib/pageScroll.ts). Un oggetto solo per tutta la
  // vita della home: l'esperienza lo riceve e il suo motore lo interroga.
  const [page] = useState(() => new PageScroll({ reduced: reducedNow }));
  const stato = useSyncExternalStore(page.subscribe, page.getStato);
  const expRef = useRef<HTMLElement>(null);
  useEffect(() => page.setTouch(isTouch), [page, isTouch]);
  useEffect(() => page.onHero(onRelock), [page, onRelock]);
  useEffect(() => {
    const hero = heroRef.current;
    const exp = expRef.current;
    if (!hero || !exp) return;
    return page.attach(hero, exp);
  }, [page]);
  const locked = isTouch && stato === "hero";
  // nell'esperienza il hero è svanito: il suo canvas si ferma
  const heroActive = heroInView && (stato === "hero" || stato === "passaggio");
  // con l'esperienza in vista l'header è il suo (HUD); sopra e sotto, la
  // TopBar del sito
  const [hudVisible, setHudVisible] = useState(false);

  useEffect(() => {
    document.documentElement.lang = pathname.startsWith("/en") ? "en" : "it";
  }, [pathname]);

  return (
    <div
      className={styles.page}
      style={
        {
          // sovrapposizione tra le due sezioni: la consuma il margine
          // negativo dell'hero (Home.module.css). Con reduced-motion le
          // sezioni restano separate, senza dissolvenze da nascondere
          "--hero-overlap": reduceMotion ? "0px" : `${HERO_OVERLAP * 100}svh`,
        } as CSSProperties
      }
    >
      <Loader onRevealStart={() => setRevealed(true)} />
      <TopBar revealed={revealed && !hudVisible} />
      {/* soglia unica pill/cursore: INVERT_TRIGGER in InvertCursor.tsx */}
      <InvertCursor sectionId="about" />

      <main>
        {/* HERO: alta 100vh, ma ne consuma solo (1 - HERO_OVERLAP) di scroll:
            svanisce mentre la sezione sotto sale e prende posizione */}
        <section
          ref={heroRef}
          id="hero"
          className={`${styles.hero} ${locked ? styles.heroLocked : ""}`}
        >
          <div
            className={`${styles.scene} ${revealed ? styles.sceneRevealed : ""}`}
            aria-hidden="true"
          >
            <Suspense fallback={null}>
              <HeroScene
                reduceMotion={reduceMotion}
                active={heroActive}
                lockGestures={locked}
              />
            </Suspense>
          </div>

          <div className={styles.overlay}>
            <h1
              className={`${styles.title} ${revealed ? styles.titleRevealed : ""}`}
            >
              <InteractiveText
                text={HERO_TITLE}
                radius={90}
                strength={12}
                maxRotation={5}
              />
            </h1>
          </div>

          {/* col mouse: la pill insegue il cursore. Col dito: un pulsante fisso,
              perché non esiste un cursore da inseguire e lo scroll è bloccato */}
          {isTouch ? null : (
            <ScrollPill label={PILL_LABEL} revealed={revealed} />
          )}
        </section>

        {/* ESPERIENZA: lo scroll 3D a step, la seconda sezione. Sale di
            HERO_OVERLAP sotto l'hero durante il passaggio e si aggancia in
            cima; la dissolvenza in entrata evita che da fermi faccia capolino.
            Alta una schermata anche mentre il chunk arriva, così "Chi siamo"
            non sale per poi saltare giù */}
        <div ref={nextRef}>
          <section ref={expRef} id="esperienza" className={styles.experience}>
            <Suspense fallback={null}>
              <Experience page={page} onHudChange={setHudVisible} />
            </Suspense>
          </section>
        </div>

        {/* DOMANDE FREQUENTI: dopo il finale, a scroll nativo. Nel bundle
            principale: è HTML e CSS, niente da caricare a parte */}
        <FaqSection />

        {/* CHI SIAMO: scrollytelling con canvas pinnato, dopo il finale
            dell'esperienza, a scroll nativo */}
        <Suspense fallback={null}>
          <AboutSection />
        </Suspense>
      </main>

      {isTouch && (
        <HeroLock
          locked={locked}
          hint={hint}
          revealed={revealed}
          onRelease={() => page.scendi()}
        />
      )}
    </div>
  );
}

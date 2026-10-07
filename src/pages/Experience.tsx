import { lazy, Suspense, useEffect, useRef } from "react";
import { DEBUG_MODE, DEBUG_ON } from "../debug/registry";
import { BackgroundLayer } from "../gl/BackgroundLayer";
import { Stage } from "../gl/Stage";
import { useStepEngine } from "../hooks/useStepEngine";
import styles from "./Experience.module.css";

// Il codice di debug non deve pesare sul sito vero: import dinamico, quindi
// finisce in un chunk a parte che senza `?debug` non viene mai chiesto.
const TypeSpecimen = lazy(() => import("../debug/TypeSpecimen"));
const DebugPanel = lazy(() => import("../debug/DebugPanel"));
const BandsProbe = lazy(() => import("../debug/BandsProbe"));

/**
 * Lo scroll 3D a step (spec `docs/URANIO_SCROLL_SPEC.md`).
 *
 * Vive su una route sua finché non è finito: la home resta pubblicabile a
 * ogni commit, e al task 8.21 questo albero si trasferisce in `Home.tsx` al
 * posto dell'hero attuale. Per ora è solo la pila di strati della sezione 4.2,
 * vuota: ogni task successivo ne riempie uno.
 */
export default function Experience() {
  const page = useRef<HTMLDivElement>(null);
  // il motore di scroll si aggancia al contenitore, non a window: fuori
  // dall'esperienza (task 8.21) la rotella deve tornare alla pagina
  useStepEngine(page);

  // La pagina non scorre: l'unico movimento è quello della scena. Riuso la
  // classe già esistente in index.css (la stessa del lock dell'hero su touch):
  // toglie le barre e il rimbalzo elastico, che qui sembrerebbe un difetto.
  useEffect(() => {
    document.documentElement.classList.add("scroll-locked");
    return () => document.documentElement.classList.remove("scroll-locked");
  }, []);

  return (
    <div className={styles.page} ref={page} tabIndex={-1}>
      <BackgroundLayer className={`${styles.layer} ${styles.bg}`} />
      <div className={`${styles.layer} ${styles.bigword}`} />
      <Stage className={`${styles.layer} ${styles.gl}`} />
      <div className={`${styles.layer} ${styles.stageUi}`} />
      <div className={`${styles.layer} ${styles.hud}`} />
      <div className={`${styles.layer} ${styles.loader}`} />
      <Suspense fallback={null}>
        {DEBUG_ON && <DebugPanel />}
        {DEBUG_MODE === "type" && <TypeSpecimen />}
        {DEBUG_MODE === "bands" && <BandsProbe />}
      </Suspense>
    </div>
  );
}

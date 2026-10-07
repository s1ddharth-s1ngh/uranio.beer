import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./Experience.module.css";

// Il codice di debug non deve pesare sul sito vero: import dinamico, quindi
// finisce in un chunk a parte che senza `?debug` non viene mai chiesto.
const TypeSpecimen = lazy(() => import("../debug/TypeSpecimen"));

/**
 * Lo scroll 3D a step (spec `docs/URANIO_SCROLL_SPEC.md`).
 *
 * Vive su una route sua finché non è finito: la home resta pubblicabile a
 * ogni commit, e al task 8.21 questo albero si trasferisce in `Home.tsx` al
 * posto dell'hero attuale. Per ora è solo la pila di strati della sezione 4.2,
 * vuota: ogni task successivo ne riempie uno.
 */
export default function Experience() {
  const [params] = useSearchParams();
  const debug = params.get("debug");
  // La pagina non scorre: l'unico movimento è quello della scena. Riuso la
  // classe già esistente in index.css (la stessa del lock dell'hero su touch):
  // toglie le barre e il rimbalzo elastico, che qui sembrerebbe un difetto.
  useEffect(() => {
    document.documentElement.classList.add("scroll-locked");
    return () => document.documentElement.classList.remove("scroll-locked");
  }, []);

  return (
    <div className={styles.page}>
      <canvas className={`${styles.layer} ${styles.bg}`} id="bg" />
      <div className={`${styles.layer} ${styles.bigword}`} />
      <canvas className={`${styles.layer} ${styles.gl}`} id="gl" />
      <div className={`${styles.layer} ${styles.stageUi}`} />
      <div className={`${styles.layer} ${styles.hud}`} />
      <div className={`${styles.layer} ${styles.loader}`} />
      {debug === "type" && (
        <Suspense fallback={null}>
          <TypeSpecimen />
        </Suspense>
      )}
    </div>
  );
}

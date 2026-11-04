import { useEffect, useRef, useState } from "react";
import uranioMark from "../assets/uranio-mark.png";
import { getAssetProgress, isSceneReady } from "../lib/assetProgress";
import styles from "./Loader.module.css";

interface LoaderProps {
  // Chiamata quando l'overlay inizia a sparire: da qui la pagina può rivelarsi
  onRevealStart: () => void;
  duration?: number; // durata minima del conteggio 0→100 in ms
}

// Flag a livello di modulo: il loader appare solo al primo mount della sessione,
// non ad ogni navigazione client-side o re-render
let alreadyShown = false;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function Loader({ onRevealStart, duration = 1600 }: LoaderProps) {
  // Catturato una volta per istanza: regge anche al doppio effect di StrictMode
  const [skip] = useState(alreadyShown);
  const [displayed, setDisplayed] = useState(0);
  const [phase, setPhase] = useState<"counting" | "full" | "leaving" | "done">(
    skip ? "done" : "counting",
  );

  const onRevealRef = useRef(onRevealStart);
  useEffect(() => {
    onRevealRef.current = onRevealStart;
  });

  useEffect(() => {
    if (skip) {
      onRevealRef.current();
      return;
    }
    alreadyShown = true;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const total = reduce ? 300 : duration;

    let rafId = 0;
    let timeoutId = 0;
    let shown = 0;
    let fontsOk = document.fonts?.status === "loaded";
    document.fonts?.ready.then(() => {
      fontsOk = true;
    });
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      const timeTarget = easeInOutCubic(t) * 100;
      // il contatore sale col tempo ma non supera il caricamento reale:
      // finché il chunk della scena non ha riportato nulla si ferma a 90
      // (chunk three in download), poi segue il progresso dei GLB; l'ultimo
      // passo aspetta font e scena pronta (shader compilati, ambiente
      // generato), così il primo frame scoperto è già composto.
      // Failsafe: oltre i 12s si sblocca comunque (asset falliti, no WebGL)
      const asset = getAssetProgress();
      const glb = !asset.reported ? 90 : asset.active ? asset.progress : 100;
      const pronto = fontsOk && isSceneReady();
      const cap = now - start > 12000 ? 100 : Math.min(glb, pronto ? 100 : 96);
      shown = Math.max(shown, Math.min(timeTarget, cap)); // mai all'indietro
      setDisplayed(Math.round(shown));

      if (shown < 100) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      // 100%: la linea è piena e il logo sfuma, poi l'overlay sparisce e
      // parte l'ingresso della scena. Tempi = transizioni del CSS + margine
      setPhase("full");
      timeoutId = window.setTimeout(() => {
        setPhase("leaving");
        onRevealRef.current();
        timeoutId = window.setTimeout(() => setPhase("done"), 750);
      }, reduce ? 0 : 450);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [skip, duration]);

  if (phase === "done") return null;

  return (
    <div
      className={`${styles.overlay} ${phase !== "counting" ? styles.full : ""} ${phase === "leaving" ? styles.leaving : ""}`}
      role="status"
      aria-label="Caricamento"
    >
      {/* il contatore animato è aria-hidden: la live region annuncia solo
          "Caricamento" una volta, non cento aggiornamenti di percentuale */}
      <div className={styles.counter} aria-hidden="true">
        <img className={styles.logo} src={uranioMark} alt="" width={96} height={96} />
        <span className={styles.track}>
          <i className={styles.fill} style={{ transform: `scaleX(${displayed / 100})` }} />
        </span>
        <span className={styles.value}>{displayed}%</span>
      </div>
    </div>
  );
}

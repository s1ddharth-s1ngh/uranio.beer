import { lazy, Suspense, useRef, useState } from "react";
import { DEBUG_MODE, DEBUG_ON } from "../debug/registry";
import { BackgroundLayer } from "../gl/BackgroundLayer";
import { Stage } from "../gl/Stage";
import { useCarouselDrag } from "../hooks/useCarouselDrag";
import { useHeroLock } from "../hooks/useHeroLock";
import { useStepEngine } from "../hooks/useStepEngine";
import { hasWebGL2 } from "../gl/webgl";
import { Fallback } from "../ui/Fallback";
import { HeroUi } from "../ui/HeroUi";
import { Finale } from "../ui/Finale";
import { Hud } from "../ui/Hud";
import { StepTextLayer } from "../ui/StepTextLayer";
import styles from "./Experience.module.css";

// Il codice di debug non deve pesare sul sito vero: import dinamico, quindi
// finisce in un chunk a parte che senza `?debug` non viene mai chiesto.
const TypeSpecimen = lazy(() => import("../debug/TypeSpecimen"));
const DebugPanel = lazy(() => import("../debug/DebugPanel"));
const BandsProbe = lazy(() => import("../debug/BandsProbe"));

// Costante di modulo e non oggetto inline: è una dipendenza di `useEffect`.
const DRAG_CLASSES = { grab: styles.grab, grabbing: styles.grabbing };

/**
 * Lo scroll 3D a step (spec `docs/URANIO_SCROLL_SPEC.md`), in cima alla home
 * al posto del vecchio hero. Dal finale un gesto verso il basso restituisce lo
 * scroll alla pagina (task 8.21, `useHeroLock`).
 *
 * `onHudChange` dice alla home se l'header dell'HUD è in vista: quando non lo
 * è, al suo posto va la `TopBar` del sito.
 */
function Scene({
  onHudChange,
  onContextLost,
}: {
  onHudChange?: (visible: boolean) => void;
  onContextLost: () => void;
}) {
  const page = useRef<HTMLDivElement>(null);
  const host = useHeroLock(page, onHudChange);
  // il motore di scroll si aggancia al contenitore, non a window: fuori
  // dall'esperienza la rotella deve tornare alla pagina
  const { step } = useStepEngine(page, host);
  // il carosello si trascina solo nell'hero: convive con il motore a step
  // sullo stesso elemento, vince l'asse del primo movimento
  useCarouselDrag(page, DRAG_CLASSES);

  return (
    <div className={styles.page} ref={page} tabIndex={-1}>
      {/* l'ordine nel DOM è l'ordine di tabulazione (task 8.24): header,
          controlli dell'hero, testo, call to action del finale. Chi sta
          davanti a chi lo decide lo z-index, non la posizione qui */}
      <Hud step={step} className={`${styles.layer} ${styles.hud}`} />
      <BackgroundLayer className={`${styles.layer} ${styles.bg}`} />
      <Stage className={`${styles.layer} ${styles.gl}`} onContextLost={onContextLost} />
      <HeroUi step={step} className={`${styles.layer} ${styles.stageUi}`} />
      <StepTextLayer className={`${styles.layer} ${styles.stageUi}`} />
      {/* due strati, uno dietro e uno davanti alla bottiglia */}
      <Finale
        wordClassName={`${styles.layer} ${styles.bigword}`}
        uiClassName={`${styles.layer} ${styles.stageUi}`}
      />
      <div className={`${styles.layer} ${styles.loader}`} />
      <Suspense fallback={null}>
        {DEBUG_ON && <DebugPanel />}
        {DEBUG_MODE === "type" && <TypeSpecimen />}
        {DEBUG_MODE === "bands" && <BandsProbe />}
      </Suspense>
    </div>
  );
}

/**
 * Senza WebGL2, o con il contesto perso a metà, la versione statica (task
 * 8.24). La prova si fa una volta, prima di montare scena e sfondo: un
 * contesto perso dopo non torna, e la pagina resta statica fino al reload.
 */
export default function Experience(
  props: Omit<Parameters<typeof Scene>[0], "onContextLost">,
) {
  const [statica, setStatica] = useState(() => !hasWebGL2());
  if (statica) return <Fallback onHudChange={props.onHudChange} />;
  return <Scene {...props} onContextLost={() => setStatica(true)} />;
}

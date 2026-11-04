import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { DEBUG_MODE, DEBUG_ON } from "../debug/registry";
import { BackgroundLayer } from "../gl/BackgroundLayer";
import { Stage } from "../gl/Stage";
import { sharedIntro } from "../core/Intro.ts";
import { sharedProgress } from "../core/Progress.ts";
import { useExperienceLock } from "../hooks/useExperienceLock";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useStepEngine } from "../hooks/useStepEngine";
import type { PageScroll } from "../lib/pageScroll";
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

/**
 * Lo scroll 3D a step (spec `docs/URANIO_SCROLL_SPEC.md`), seconda sezione
 * della home dopo il hero. Ci si arriva col passaggio animato dal hero, e dal
 * finale un gesto verso il basso restituisce lo scroll alla pagina: lo scroll
 * lo comanda la home (`page`, `lib/pageScroll.ts`).
 *
 * `onHudChange` dice alla home se l'header dell'HUD è in vista: quando non lo
 * è, al suo posto va la `TopBar` del sito.
 */
function Scene({
  page,
  onHudChange,
  onContextLost,
}: {
  page: PageScroll;
  onHudChange?: (visible: boolean) => void;
  onContextLost: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reveal = useExperienceLock(root, page, onHudChange);
  // il motore di scroll si aggancia al contenitore, non a window: fuori
  // dall'esperienza la rotella deve tornare alla pagina
  const { step } = useStepEngine(root, page);

  // l'ingresso (la bottiglia che arriva) parte nell'ultimo tratto del
  // passaggio dal hero: fino ad allora `intro` resta a 0, la scena è composta
  // ma spenta e sotto il frame. Con `#step-N` nell'URL si salta
  useEffect(() => {
    if (reveal === "wait") return;
    const intro = sharedIntro();
    const daHero = sharedProgress().target === 0;
    if (reveal === "play" && daHero && !prefersReducedMotion()) intro.play();
    else intro.skip();
  }, [reveal]);

  return (
    <div className={styles.page} ref={root} tabIndex={-1}>
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

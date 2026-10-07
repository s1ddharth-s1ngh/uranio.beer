import { useEffect, useRef, useState } from "react";
import { HERO_OVERLAP } from "../lib/heroTransition";

// niente cursore custom su touch (valutato una volta al mount)
const isTouchDevice = () =>
  window.matchMedia("(hover: none), (pointer: coarse)").matches;

/**
 * Soglia condivisa (frazione di viewport): quando il top della 2ª sezione
 * sale oltre questa linea, la sezione "è arrivata" → cursore atomo attivo.
 * ScrollPill usa la STESSA soglia al contrario (pill visibile solo prima),
 * così non esiste mai una zona morta senza né pill né cursore atomo.
 *
 * Lo 0.8 di partenza è la soglia voluta; il meno HERO_OVERLAP la compensa,
 * perché la 2ª sezione ora sta più in alto nel documento (margine negativo
 * dell'hero) e senza correzione scatterebbe già a scroll fermo.
 */
export const ATOM_TRIGGER = 0.8 - HERO_OVERLAP;

// Centro del 92 rispetto all'hotspot del cursore nativo (cursor-92.svg, punta
// in 2,6): le orbite girano attorno al numero, che fa da nucleo.
const NUCLEUS = { x: 16, y: 10 };

// Orbite: [inclinazione (gradi), periodo (s), fase di partenza (s)]. Periodi
// non multipli tra loro, così gli elettroni non si riallineano mai in un
// disegno che si ripete.
const ORBITS: [number, number, number][] = [
  [0, 2.7, 0],
  [60, 3.4, -1.1],
  [120, 4.3, -2.6],
];
// ellisse di raggi 38×12 centrata in (48,48), percorsa da animateMotion
const ORBIT_PATH = "M10 48a38 12 0 1 0 76 0a38 12 0 1 0-76 0";

/**
 * Atomo attorno al puntatore: tre orbite sottili con un elettrone ciascuna, il
 * nucleo è il 92 del cursore nativo. Segue il mouse senza inerzia — è parte
 * del puntatore, non un oggetto che lo insegue.
 * Si attiva appena la seconda sezione (sectionId) "arriva": quando il suo
 * bordo superiore entra oltre `trigger` × altezza viewport, e resta attivo
 * per tutto ciò che sta sotto. Disabilitato su touch. Stili in index.css.
 */
export default function AtomCursor({
  sectionId = "about", // la SECONDA sezione
  trigger = ATOM_TRIGGER, // 0..1: più ALTO = si attiva PRIMA
}: {
  sectionId?: string;
  trigger?: number;
}) {
  const atom = useRef<HTMLDivElement>(null);
  const [enabled] = useState(() => !isTouchDevice());
  // con meno animazioni gli elettroni restano fermi sulle orbite
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!enabled) return;
    const pos = { x: -200, y: -200 };
    let raf = 0;
    let active = false;

    // un solo scrittore per frame: a mouse veloce arrivano più eventi per frame
    const paint = () => {
      raf = 0;
      if (atom.current) {
        atom.current.style.transform = `translate3d(${pos.x + NUCLEUS.x}px, ${pos.y + NUCLEUS.y}px, 0) translate(-50%, -50%)`;
      }
    };
    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    // feedback: l'atomo si allarga sugli elementi interattivi
    const onOver = (e: MouseEvent) => {
      const interactive =
        e.target instanceof Element &&
        e.target.closest("a, button, [role='button']");
      atom.current?.classList.toggle("atom-cursor--grow", !!interactive);
    };

    // ATTIVAZIONE: appena la 2ª sezione "arriva" (anche senza scroll completo),
    // e resta attiva per tutto ciò che sta sotto. Legata a scroll/resize, non
    // al render loop. La sezione è lazy: un ricontrollo differito copre il caso
    // in cui il chunk non fosse ancora montato al mount di questo effetto.
    const updateActive = () => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const shouldActive =
        el.getBoundingClientRect().top <= window.innerHeight * trigger;
      if (shouldActive === active) return;
      active = shouldActive;
      if (atom.current) atom.current.style.opacity = shouldActive ? "1" : "0";
    };
    updateActive();
    const retry = setTimeout(updateActive, 1500);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      clearTimeout(retry);
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [sectionId, trigger, enabled]);

  if (!enabled) return null;
  return (
    <div ref={atom} className="atom-cursor" aria-hidden="true">
      <svg viewBox="0 0 96 96">
        {ORBITS.map(([tilt, period, phase], i) => (
          <g key={tilt} transform={`rotate(${tilt} 48 48)`}>
            <path className="atom-cursor__orbit" d={ORBIT_PATH} />
            <circle
              className={`atom-cursor__electron atom-cursor__electron--${i % 2 ? "violet" : "blue"}`}
              r="2"
              // animateMotion trasla a partire da 0,0; da fermo lo metto io
              // su un punto dell'orbita (l'estremo destro dell'ellisse)
              cx={reduced ? 86 : 0}
              cy={reduced ? 48 : 0}
            >
              {/* SMIL e non CSS: segue il path esatto dell'orbita anche
                  dentro un <g> ruotato, dove offset-path non è affidabile */}
              {!reduced && (
                <animateMotion
                  dur={`${period}s`}
                  begin={`${phase}s`}
                  repeatCount="indefinite"
                  path={ORBIT_PATH}
                />
              )}
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}

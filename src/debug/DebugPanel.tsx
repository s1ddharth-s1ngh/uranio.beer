import { useEffect, useRef } from "react";
import GUI from "lil-gui";
import Stats from "stats-gl";
import {
  debugSections,
  debugSnapshot,
  onDebugSectionsChange,
} from "./registry";
import { onTick } from "../core/Ticker";
import { sharedViewport } from "../hooks/useViewport";
import styles from "./DebugPanel.module.css";

/**
 * Il pannello di regolazione (spec 8.5). Importato dinamicamente da
 * `Experience.tsx` solo con `?debug`: lil-gui e stats-gl finiscono in un chunk
 * a parte che il sito vero non chiede mai.
 *
 * Non conosce nessun modulo dell'esperienza: le manopole arrivano dal
 * registro (`registry.ts`), così luci, keyframe e shader si iscrivono da sé
 * senza che il pannello li importi.
 */
export default function DebugPanel() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    // --- fps, ms e (quando c'è un renderer) tempo GPU
    const stats = new Stats({ trackGPU: false, horizontal: false });
    stats.dom.style.position = "static";
    parent.appendChild(stats.dom);
    const stopTick = onTick(() => stats.update());

    // --- il pannello, ricostruito quando qualcuno si iscrive o si stacca
    const vp = sharedViewport();
    let gui: GUI | undefined;

    const build = () => {
      gui?.destroy();
      gui = new GUI({ title: "uranio · debug", container: parent });

      const schermo = { ...vp.state };
      const fVp = gui.addFolder("viewport");
      for (const k of Object.keys(schermo) as (keyof typeof schermo)[]) {
        // `listen()` rilegge il valore a ogni frame, `disable()` lo rende di
        // sola lettura: è un tabellone, non una manopola
        fVp.add(schermo, k).listen().disable();
      }
      fVp.close();
      const stopVp = vp.subscribe((s) => Object.assign(schermo, s));

      for (const sec of debugSections()) {
        const f = gui.addFolder(sec.title);
        for (const [key, value] of Object.entries(sec.target)) {
          const knob = sec.knobs?.[key];
          const c =
            knob?.options && typeof value === "string"
              ? f.add(sec.target, key, [...knob.options])
              : f.add(sec.target, key, knob?.min, knob?.max, knob?.step);
          if (knob?.readonly) c.listen().disable();
          else if (sec.onChange) c.onChange(sec.onChange);
        }
        if (!sec.open) f.close();
      }

      // "copia keyframe": lo stato di tutte le manopole, pronto da incollare
      // in src/config/. Il clipboard fallisce fuori da HTTPS e senza gesto
      // dell'utente, quindi la console è la rete di sicurezza.
      gui
        .add(
          {
            copia: () => {
              const json = JSON.stringify(debugSnapshot(), null, 2);
              navigator.clipboard?.writeText(json).catch(() => {});
              console.log(json);
            },
          },
          "copia",
        )
        .name("copia keyframe (JSON)");

      return stopVp;
    };

    let stopVp = build();
    const stopSections = onDebugSectionsChange(() => {
      stopVp();
      stopVp = build();
    });

    return () => {
      stopSections();
      stopVp();
      stopTick();
      gui?.destroy();
      stats.dom.remove();
    };
  }, []);

  return <div ref={host} className={styles.host} />;
}

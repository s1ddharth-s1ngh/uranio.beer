import { useEffect, useRef } from "react";
import { sharedMapper } from "../core/StateMapper.ts";
import { onTick } from "../core/Ticker.ts";
import { sharedViewport } from "../hooks/useViewport";
import { Background } from "./Background.ts";

/**
 * Lo strato di fondo (spec 4.2 strato 1). Il canvas è suo e non di R3F: lo
 * guida la classe `Background`, agganciata allo stesso ticker di tutto il
 * resto.
 */
export function BackgroundLayer({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const vp = sharedViewport();
    const bg = new Background(el);
    bg.resize(vp.state);
    const stopVp = vp.subscribe((s) => bg.resize(s));
    const mapper = sharedMapper(vp.state);
    const stopTick = onTick((time) => bg.render(time, mapper.state.background));
    return () => {
      stopVp();
      stopTick();
      bg.dispose();
    };
  }, []);

  return <canvas id="bg" ref={canvas} className={className} />;
}

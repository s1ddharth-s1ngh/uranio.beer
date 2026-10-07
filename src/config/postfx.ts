// Post-processing (spec 6.9). Valori di partenza: il bloom e' l'effetto che
// piu' facilmente rovina tutto, quindi la soglia e' alta di proposito.

export const POSTFX = {
  /** antialias: lo fa il composer, non il contesto WebGL */
  multisampling: 4,
  /**
   * Deve brillare solo il bordo del tappo, la lama di luce e il disco del
   * faro. Con la soglia piu' bassa si accende anche l'etichetta bianca, e
   * l'effetto diventa una foschia su tutto.
   */
  bloom: { threshold: 0.85, smoothing: 0.12, intensity: 0.6 },
  vignette: { offset: 0.3, darkness: 0.55 },
  noise: { opacity: 0.03 },
} as const;

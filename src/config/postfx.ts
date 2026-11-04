// Post-processing (spec 6.9). Valori di partenza: il bloom e' l'effetto che
// piu' facilmente rovina tutto, quindi la soglia e' alta di proposito.

export const POSTFX = {
  /**
   * Antialias: lo fa il composer, non il contesto WebGL. Con FXAA e non con
   * l'MSAA 4× del composer: su una GPU integrata (AMD, 1440×900 a DPR 1)
   * l'MSAA su render target a mezza precisione portava la scena da 60 a
   * 19–30 fps, misurato il 2026-11-04. FXAA è un passaggio a schermo intero e
   * basta: i bordi del vetro restano puliti, un filo più morbidi.
   */
  multisampling: 0,
  /**
   * Deve brillare solo il bordo del tappo, la lama di luce e il disco del
   * faro. Con la soglia piu' bassa si accende anche l'etichetta bianca, e
   * l'effetto diventa una foschia su tutto.
   */
  bloom: { threshold: 0.85, smoothing: 0.12, intensity: 0.6 },
  vignette: { offset: 0.3, darkness: 0.55 },
  noise: { opacity: 0.03 },
} as const;

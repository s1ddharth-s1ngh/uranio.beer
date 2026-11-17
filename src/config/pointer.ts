// Quanto le bottiglie seguono il cursore (`core/Pointer.ts`). Angoli in
// radianti, con `SceneState.look` a 1 e il cursore abbastanza di lato.
//
// L'effetto è **locale** (richiesta del 2026-11-17: "non deve muovere tutte le
// bottiglie... centralizziamo sopra dove ho il mouse"): si gira verso il
// cursore la bottiglia che gli sta vicino, le altre sempre meno. Le distanze
// sono in mezze altezze di schermo, uguali in orizzontale e in verticale.

export const POINTER = {
  /** a destra / a sinistra: una bottiglia è un cilindro, sotto i ~15° non si nota */
  yaw: 0.34,
  /** in alto / in basso: meno, la bottiglia è alta e il collo spazzerebbe lo schermo */
  pitch: 0.2,
  /**
   * Il raggio della campana d'influenza: a questa distanza dal cursore una
   * bottiglia segue al 60%, al doppio al 14%. Sul gruppo dell'anello, col
   * cursore sulla protagonista, le vicine seguono a metà e le esterne quasi
   * per niente
   */
  sigma: 0.45,
  /** oltre questo scarto dal centro della bottiglia la rotazione è piena */
  reach: 0.35,
  /** costante di tempo dello smorzamento, in secondi: segue subito, senza scatti */
  tau: 0.3,
} as const;

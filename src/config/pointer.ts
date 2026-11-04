// Quanto la scena segue il cursore (`core/Pointer.ts`). Angoli in radianti al
// bordo della finestra, con `SceneState.look` a 1.

export const POINTER = {
  /**
   * a destra / a sinistra: la faccia si gira di ~24°. Sembra tanto, ma una
   * bottiglia è un cilindro: girandola sul suo asse la sagoma non cambia e
   * scivola solo l'etichetta, e sotto i 20° non lo nota nessuno
   */
  yaw: 0.42,
  /** in alto / in basso: meno, la bottiglia è alta e il collo spazzerebbe lo schermo */
  pitch: 0.26,
  /** costante di tempo dello smorzamento, in secondi: segue, non insegue */
  tau: 0.45,
  /** l'anello e la fila seguono con questa frazione: il fondo si muove meno del primo piano */
  ring: 0.35,
} as const;

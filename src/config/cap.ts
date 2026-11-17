// Il tappo che si stacca (riferimento: la richiesta del proprietario del
// 2026-11-04). Chiuso nell'anello e sul fronte; quando la bottiglia gira sul
// retro salta via e resta sospeso accanto a lei, fermo, finché la gamma non
// arriva e lui torna sul collo. Misure in unità del modello, angoli
// in radianti. La regia (quando) sta nelle finestre `tappo` di
// `keyframes.ts`; qui c'è solo la forma del movimento.

export const CAP_MOTION = {
  /** di quanto salta lungo l'asse della bottiglia prima di partire */
  pop: 0.55,
  /** quale tratto di `cap` (0–1) occupa il salto; il volo parte un poco prima che finisca */
  popUntil: 0.35,
  flyFrom: 0.18,
  /**
   * Dove resta sospeso: un punto dello schermo (0–1 dall'alto a sinistra) e
   * la distanza dalla camera. Ancorato allo schermo e non alla bottiglia: sul
   * retro lei gira di step in step, e un tappo che la seguisse girerebbe con
   * lei a ogni step. Desktop: in alto a destra, fra la bottiglia e
   * l'indice degli step, poco davanti a lei (la camera del retro sta a 11):
   * più vicino sembrava un piatto accanto a una bottiglia intera.
   * Verticale: in alto a destra, sopra la spalla e un filo sotto l'header,
   * che a 0,12 il tappo sfiorava.
   */
  hover: {
    desktop: { screen: [0.82, 0.22], depth: 8.5 },
    portrait: { screen: [0.78, 0.17], depth: 12.5 },
  },
  /** da sospeso è inclinato verso la camera: si vede la corona di tre quarti */
  tilt: 0.95,
  /** e un filo di traverso */
  roll: -0.3,
  /** giri sul proprio asse durante il volo */
  spins: 1.25,
  /** a metà volo fa una capriola, poi si raddrizza */
  tumble: 0.7,
  /**
   * L'intensità dello spot della cima quando il tappo è sospeso: lo spot lo
   * segue (`gl/Lights.tsx`). Lo spot e non una luce sua: ogni luce in scena
   * si paga in ogni pixel di ogni materiale, accesa o spenta, e su una GPU
   * integrata una puntiforme in più costava ~2 ms a frame
   */
  spot: 0.9,
  /** il bagliore alla bocca nel momento in cui salta */
  flash: { at: 0.12, width: 0.1, scale: 1.4, opacity: 0.9 },
} as const;

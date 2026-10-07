// Tempi delle animazioni dei testi (spec 7.6). Stanno qui e non nel
// componente per la regola 10.1.4: niente numeri magici nel codice.

export const TEXT = {
  /** uscita: le righe salgono dietro la maschera, titolo per primo */
  exit: { duration: 0.4, stagger: 0.05, ease: "power2.in" },
  /**
   * Entrata: parte al 45% della durata della transizione 3D, cosi' il testo
   * nuovo arriva mentre la bottiglia e' ancora in movimento. Partire a fine
   * corsa farebbe sembrare l'interfaccia in ritardo sulla scena.
   */
  enter: {
    delayFraction: 0.45,
    duration: 0.7,
    stagger: 0.07,
    ease: "power3.out",
  },
  /** il riquadro del tag si apre da sinistra */
  tag: { duration: 0.35 },
  /** la riga barrata, dopo l'entrata del titolo */
  strike: { duration: 0.45, ease: "power2.inOut", overlap: 0.2 },
} as const;

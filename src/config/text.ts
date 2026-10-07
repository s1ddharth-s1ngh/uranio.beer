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

/**
 * Il finale: scritta gigante "ZERO / CRISI", riga piccola e due bottoni
 * (spec 7.6 e 8.20).
 */
export const FINALE = {
  /**
   * La scritta entra a questa frazione della durata della transizione verso
   * il finale: la bottiglia deve essersi quasi fermata (`verify:core` misura
   * quanto manca alla rotazione a questo punto).
   */
  enterAt: 0.8,
  /** entrata delle lettere, una alla volta in ordine sparso */
  chars: { duration: 0.9, stagger: 0.05, ease: "power3.out", opacity: 0.35 },
  /**
   * Uscita, subito alla partenza della transizione all'indietro. Deve finire
   * prima che la bottiglia ricominci a ruotare: il tetto lo calcola
   * `verify:core` dalla curva `uranio`.
   */
  exit: { duration: 0.25, ease: "power2.in" },
  /** riga piccola e bottoni: entrano dopo le lettere, sovrapposti di tanto */
  cta: { duration: 0.6, stagger: 0.08, ease: "power3.out", overlap: 0.5 },
  /**
   * Bordo alto del blocco sotto la bottiglia, in frazione dell'altezza del
   * viewport. Arriva al CSS come variabile, così la pagina e `verify:core`
   * leggono lo stesso numero.
   */
  ctaTop: { desktop: 0.85, mobile: 0.72 },
} as const;

/** L'interfaccia dell'hero: nome, frecce, slider, invito a scorrere (task 8.19). */
export const HERO_UI = {
  /**
   * Dove sta il logotipo rispetto al bordo alto anteriore del piedistallo:
   * 0 tutto sopra, 1 tutto sotto. A metà copre il bordo senza coprire il fondo
   * della bottiglia, che sopra il piedistallo non lascia spazio. Da tarare a
   * occhio (task 8.28).
   */
  nameAnchor: 0.5,
  /** distanza delle frecce dal centro della protagonista, in px */
  arrowOffset: 120,
  /** uscita al passaggio 0 → 1 (spec 7.6): opacità e un filo verso il basso */
  exit: { duration: 0.35, y: 20 },
  /**
   * Al ritorno 1 → 0 si rientra dopo che le laterali sono tornate: andando
   * indietro la loro finestra [0; 0,5] del segmento si percorre nella seconda
   * metà della corsa. Frazione della durata di `durationFor(1, 0)`.
   */
  returnDelayFraction: 0.55,
} as const;

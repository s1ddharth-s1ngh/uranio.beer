// Tempi delle animazioni dei testi (spec 7.6). Stanno qui e non nel
// componente per la regola 10.1.4: niente numeri magici nel codice.

export const TEXT = {
  /**
   * Uscita: il tag si chiude verso destra, le righe salgono dietro la
   * maschera sfocandosi, titolo per primo. `stagger` è il ritardo totale
   * fra la prima riga e l'ultima, non per riga: così tutto è fuori in
   * mezzo secondo, prima che l'entrata del testo nuovo (che parte ad
   * almeno 0,54 s) lo possa incrociare.
   */
  exit: { duration: 0.4, stagger: 0.1, ease: "power2.in", y: -110, blur: 4 },
  /**
   * Entrata: parte al 45% della durata della transizione 3D, cosi' il testo
   * nuovo arriva mentre la bottiglia e' ancora in movimento. Partire a fine
   * corsa farebbe sembrare l'interfaccia in ritardo sulla scena.
   */
  enter: { delayFraction: 0.45 },
  // i pezzi dell'entrata: `at` è il secondo, dall'inizio dell'entrata, in
  // cui ognuno parte
  /** il tag si scopre da sinistra, filo rosso per primo */
  tag: { duration: 0.9, ease: "expo.out", at: 0 },
  /**
   * Il titolo, lettera per lettera: ognuna sale da sotto la maschera
   * raddrizzandosi e mettendosi a fuoco. `expo.out` fa quasi tutta la
   * strada nel primo terzo e poi si posa: è la differenza fra un testo che
   * arriva e uno che scivola. `y` è in percento dell'altezza della lettera:
   * oltre il 100 perché parta tutta sotto il bordo della maschera, che
   * scende un poco più giù della riga per non tagliare le discendenti.
   */
  chars: { duration: 1.1, stagger: 0.022, ease: "expo.out", at: 0.05, y: 120, rotateX: 60, blur: 6 },
  /** il paragrafo, parola per parola dentro le sue righe, dopo il titolo */
  words: { duration: 0.9, stagger: 0.012, ease: "expo.out", at: 0.32 },
  /**
   * La riga barrata, quando il titolo si è posato: è una cancellatura, e
   * una cancellatura ha senso solo su qualcosa che si è già letto.
   */
  strike: { duration: 0.5, ease: "power2.inOut", at: 0.8 },
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
  // tenue: nel finale parla la fila di bottiglie (riferimento, immagine 17),
  // la scritta resta solo come fondo
  chars: { duration: 0.9, stagger: 0.05, ease: "power3.out", opacity: 0.14 },
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

/**
 * L'interfaccia dell'anello: stile, gradazione e invito a scorrere
 * (task 8.19). Il fronte ha il blocco di testo degli step (`TEXT`).
 */
export const HERO_UI = {
  /** uscita (spec 7.6): opacità e un filo verso il basso */
  exit: { duration: 0.35, y: 20 },
  /**
   * Si rientra quando la bottiglia è quasi arrivata al suo posto. Frazione
   * della durata di `durationFor(1, 0)`.
   */
  returnDelayFraction: 0.55,
} as const;

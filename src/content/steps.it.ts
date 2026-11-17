// Tutti i testi dell'esperienza, in un posto solo: nel codice non deve
// comparire una stringa visibile all'utente.
//
// La spec chiede un `steps.it.json`; qui è un `.ts` perché il repo lo fa già
// così (`content/faq.it.ts`) e perché un modulo tipizzato fa fallire `tsc` se
// un campo manca, cosa che un JSON senza schema non fa.
//
// ⚠️ Bozza: i fatti vengono tutti dall'etichetta, ma i testi sono da far
// validare dal birrificio (spec 10.2).

/**
 * Il tag sopra il titolo: un filo rosso e un'etichetta. Il testo va scritto
 * normale, il maiuscolo lo mette il CSS: in maiuscolo nel sorgente certi
 * screen reader lo compitano lettera per lettera.
 */
export interface StepTag {
  text: string;
  /** se vero, dopo l'entrata del titolo una riga lo attraversa da sinistra */
  strike?: boolean;
}

export interface Step {
  /** chiave stabile: compare nell'hash dell'URL e nei test */
  id: string;
  tag?: StepTag;
  title?: string;
  /** chi ha un paragrafo ha il blocco di testo a sinistra (`StepTextLayer`) */
  body?: string;
  /**
   * Una delle quattro fasce del retro: la elenca l'indice numerato a destra
   * (`StepIcons`, spec 8.17), che si vede solo su questi step.
   */
  band?: true;
  /** anello: stile e gradazione, sotto il piedistallo */
  subtitle?: string;
  scrollHint?: string;
  /**
   * Immagine della versione senza WebGL (task 8.24): un file di
   * `public/images/`, ritagliato dalla texture con `scripts/crop-label.mjs`.
   */
  image?: { file: string; alt: string };
  /** solo finale: due righe, entrano lettera per lettera */
  bigWord?: [string, string];
  note?: string;
  cta?: { label: string; href: string }[];
}

/**
 * Le lettere a bassa opacità sparse sullo sfondo dell'HUD: due righe, una in
 * alto e una in basso, distribuite su tutta la larghezza.
 */
export const HUD_LETTERS = { top: "CRISI", bottom: "ECONOMICA" } as const;

export const STEPS: Step[] = [
  {
    // l'anello: tutte le bottiglie, stile e gradazione sotto il piedistallo.
    // Il nome qui lo portano le etichette: il titolo resta per screen reader
    // e versione statica
    id: "anello",
    title: "Crisi Economica",
    subtitle: "Ordinary Bitter · 4,2%",
    scrollHint: "Scorri per scoprire",
    // niente immagine nella versione statica: era il logotipo a pennello,
    // tolto dappertutto su richiesta del proprietario (2026-11-17)
  },
  {
    // il fronte: lei sola, intera a destra, il nome nel blocco a sinistra
    id: "fronte",
    tag: { text: "Ordinary Bitter · 4,2%" },
    title: "Crisi Economica",
    body: "Una Ordinary Bitter all'inglese, leggera e da bere a pinte. Per i giorni in cui tutto va storto.",
  },
  {
    id: "f1",
    tag: { text: "4 ingredienti" },
    band: true,
    image: { file: "crisi-economica-fascia-1.webp", alt: "Il retro dell'etichetta: nome della birra e ingredienti" },
    title: "Ordinary Bitter",
    body: "Acqua, malto d'orzo, luppolo, lievito. Nient'altro in etichetta.",
  },
  {
    id: "f2",
    tag: { text: "Crisi", strike: true },
    band: true,
    image: { file: "crisi-economica-fascia-2.webp", alt: "Il retro dell'etichetta: motto e produttore" },
    title: "Trasforma la crisi in piacere",
    body: "Prodotta e confezionata per Uranio a Castelletto Stura (CN), in Piemonte.",
  },
  {
    id: "f3",
    tag: { text: "4,2% vol" },
    band: true,
    image: { file: "crisi-economica-fascia-3.webp", alt: "Il retro dell'etichetta: gradazione, formato e marchio Uranio" },
    title: "33 cl di leggerezza",
    body: "Gradazione bassa, bottiglia da 33 cl: una birra da sessione, da stappare senza pensarci troppo.",
  },
  {
    id: "f4",
    tag: { text: "Indifferenziata", strike: true },
    band: true,
    image: { file: "crisi-economica-fascia-4.webp", alt: "Il retro dell'etichetta: raccolta differenziata e scadenza" },
    title: "Vetro, metallo, plastica",
    body: "Bottiglia in vetro GL72, tappo in metallo C/FE91, etichetta in plastica PP5. Verifica le regole del tuo comune.",
  },
  {
    // la gamma e il finale insieme: tutte in fila, il tappo chiuso, la
    // scritta gigante dietro. Il titolo serve a screen reader e versione
    // statica
    id: "finale",
    title: "Tutte le crisi",
    bigWord: ["ZERO", "CRISI"],
    note: "Conservare al freddo e al buio. Contiene deposito naturale.",
    // ⚠️ href segnaposto: destinazioni da confermare (spec 10.2)
    cta: [
      { label: "SEGUICI @URANIO.BEER", href: "https://www.instagram.com/uranio.beer/" },
      { label: "DOVE TROVARLA", href: "#contatti" },
    ],
  },
];

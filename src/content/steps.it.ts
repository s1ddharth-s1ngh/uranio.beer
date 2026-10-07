// Tutti i testi dell'esperienza, in un posto solo: nel codice non deve
// comparire una stringa visibile all'utente.
//
// La spec chiede un `steps.it.json`; qui è un `.ts` perché il repo lo fa già
// così (`components/about/aboutContent.ts`) e perché un modulo tipizzato fa
// fallire `tsc` se un campo manca, cosa che un JSON senza schema non fa.
//
// ⚠️ Bozza: i fatti vengono tutti dall'etichetta, ma i testi sono da far
// validare dal birrificio (spec 10.2).

/** Il tag sopra il titolo: un quadratino rosso e un'etichetta bianca. */
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
  body?: string;
  /** nome dell'icona Lucide nella colonna di destra (spec 8.17) */
  icon?: "wheat" | "zap" | "droplet" | "recycle";
  /** solo hero */
  subtitle?: string;
  scrollHint?: string;
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
    id: "hero",
    title: "CRISI ECONOMICA",
    subtitle: "ORDINARY BITTER · 4,2%",
    scrollHint: "SCORRI PER SCOPRIRE",
  },
  {
    id: "closeup",
    title: "CRISI ECONOMICA",
    body: "Una Ordinary Bitter all'inglese, leggera e da bere a pinte. Per i giorni in cui tutto va storto.",
  },
  {
    id: "f1",
    tag: { text: "4 INGREDIENTI" },
    icon: "wheat",
    title: "ORDINARY BITTER",
    body: "Acqua, malto d'orzo, luppolo, lievito. Nient'altro in etichetta.",
  },
  {
    id: "f2",
    tag: { text: "CRISI", strike: true },
    icon: "zap",
    title: "TRASFORMA LA CRISI IN PIACERE",
    body: "Prodotta e confezionata per Uranio a Castelletto Stura (CN), in Piemonte.",
  },
  {
    id: "f3",
    tag: { text: "4,2% VOL" },
    icon: "droplet",
    title: "33 CL DI LEGGEREZZA",
    body: "Gradazione bassa, bottiglia da 33 cl: una birra da sessione, da stappare senza pensarci troppo.",
  },
  {
    id: "f4",
    tag: { text: "INDIFFERENZIATA", strike: true },
    icon: "recycle",
    title: "VETRO, METALLO, PLASTICA",
    body: "Bottiglia in vetro GL72, tappo in metallo C/FE91, etichetta in plastica PP5. Verifica le regole del tuo comune.",
  },
  {
    id: "finale",
    bigWord: ["ZERO", "CRISI"],
    note: "Conservare al freddo e al buio. Contiene deposito naturale.",
    // ⚠️ href segnaposto: destinazioni da confermare (spec 10.2)
    cta: [
      { label: "SEGUICI @URANIO.BEER", href: "https://www.instagram.com/uranio.beer/" },
      { label: "DOVE TROVARLA", href: "#contatti" },
    ],
  },
];

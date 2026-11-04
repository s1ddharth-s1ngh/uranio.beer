// Le domande della sezione FAQ della home, dopo l'esperienza (riferimento
// ciaoenergy.com, "Foire aux questions").
//
// ⚠️ Bozza come `steps.it.ts`: le risposte usano solo quello che c'è scritto
// sull'etichetta, vanno fatte validare dal birrificio.

export const FAQ_TITLE = ["DOMANDE", "FREQUENTI"] as const;

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Che birra è Crisi Economica?",
    a: "Una Ordinary Bitter all'inglese: leggera, beverina, da bere a pinte. Per i giorni in cui tutto va storto.",
  },
  {
    q: "Quanti gradi ha?",
    a: "4,2% vol. Una gradazione bassa, da sessione: si stappa senza pensarci troppo.",
  },
  {
    q: "Con cosa è fatta?",
    a: "Acqua, malto d'orzo, luppolo e lievito. Nient'altro in etichetta.",
  },
  {
    q: "Contiene glutine?",
    a: "Sì: il malto d'orzo contiene glutine.",
  },
  {
    q: "Quanto è grande la bottiglia?",
    a: "33 cl, in vetro.",
  },
  {
    q: "Dove viene prodotta?",
    a: "È prodotta e confezionata per Uranio a Castelletto Stura (CN), in Piemonte.",
  },
  {
    q: "Come la conservo?",
    a: "Al freddo e al buio. Contiene un deposito naturale sul fondo: è normale, è il lievito.",
  },
  {
    q: "Come si ricicla?",
    a: "Bottiglia in vetro GL72, tappo in metallo C/FE91, etichetta in plastica PP5. Verifica le regole del tuo comune.",
  },
];

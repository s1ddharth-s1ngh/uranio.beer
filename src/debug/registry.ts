// L'elenco dei pannelli di debug, senza dipendere da lil-gui.
//
// Il pannello vero (`DebugPanel.tsx`) tira dentro lil-gui e stats-gl: due
// librerie che senza `?debug` non devono finire nel bundle, quindi vive in un
// import dinamico. Ma i moduli che espongono manopole (luci, keyframe, shader)
// sono codice di produzione e non possono importare il pannello. Si iscrivono
// qui: questo file non importa nulla, pesa poche righe e il peso vero resta
// dietro l'import dinamico.

/** Un valore regolabile dal pannello. */
export interface DebugKnob {
  min?: number;
  max?: number;
  step?: number;
  /** elenco chiuso di valori, diventa una tendina */
  options?: readonly string[];
}

export interface DebugSection {
  title: string;
  /** l'oggetto vero, mutato dal pannello: chi l'ha registrato legge da qui */
  target: Record<string, number | boolean | string>;
  knobs?: Record<string, DebugKnob>;
  /** chiamata dopo ogni modifica, per chi deve riapplicare (es. un materiale) */
  onChange?: () => void;
  /** aperto all'avvio: solo per la sezione su cui si sta lavorando */
  open?: boolean;
}

/**
 * `?debug` acceso. Letto una volta dall'URL, non reattivo: cambiare modalità
 * di debug a pagina aperta non è un caso d'uso, ricaricare sì.
 */
export const DEBUG_ON: boolean =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug");

/** il valore di `?debug=…`, per i pannelli specifici (`type`, `bands`, …) */
export const DEBUG_MODE: string | null =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug")
    : null;

const sections: DebugSection[] = [];
const listeners = new Set<() => void>();

/**
 * Registra una sezione. Restituisce la funzione per togliertela: serve con
 * React, dove un `useEffect` monta e smonta più volte in sviluppo.
 */
export function registerDebug(section: DebugSection): () => void {
  if (!DEBUG_ON) return () => {};
  sections.push(section);
  for (const fn of listeners) fn();
  return () => {
    const i = sections.indexOf(section);
    if (i >= 0) sections.splice(i, 1);
    for (const fn of listeners) fn();
  };
}

export function debugSections(): readonly DebugSection[] {
  return sections;
}

/** Il pannello si ricostruisce quando l'elenco cambia. */
export function onDebugSectionsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Lo stato di tutte le manopole, pronto da incollare in `src/config/`
 * (il pulsante "copia keyframe" del task 8.5).
 */
export function debugSnapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of sections) out[s.title] = { ...s.target };
  return out;
}

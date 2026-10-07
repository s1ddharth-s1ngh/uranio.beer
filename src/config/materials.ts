// I materiali della bottiglia (spec 6.3).
//
// I colori qui non sono token della palette: `#15110d` è la tinta del vetro e
// `#4a2208` è il colore con cui la luce si spegne attraversandolo. Non
// compaiono mai nel CSS, quindi stanno qui e non in `theme.ts` — la palette
// del sito la verifica `scripts/check-tokens.mjs` token per token, e un
// colore da shader in mezzo sarebbe rumore.

import { COLORS } from "./theme.ts";

/**
 * Vetro scuro: quasi nero, ma non opaco. Vive di riflessi, quindi `roughness`
 * bassissima e `clearcoat` pieno; la `transmission` è appena 0,2 perché la
 * birra dentro è scura e non si deve vedere attraverso la bottiglia, solo
 * intuire un bordo che si illumina.
 */
export const GLASS = {
  color: "#15110d",
  metalness: 0,
  roughness: 0.06,
  transmission: 0.2,
  thickness: 0.5,
  ior: 1.5,
  attenuationColor: "#4a2208",
  attenuationDistance: 0.35,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  envMapIntensity: 1.4,
  specularIntensity: 1,
} as const;

/**
 * Su GPU debole la `transmission` è il primo costo da tagliare: obbliga il
 * renderer a un passaggio in più sulla scena per ogni oggetto trasparente.
 */
export const GLASS_LOW_END = { transmission: 0, thickness: 0 } as const;

/** Tappo a corona: metallo rosso laccato. */
export const CAP_MATERIAL = {
  color: COLORS.red,
  metalness: 0.85,
  roughness: 0.32,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.6,
} as const;

/**
 * Etichetta: carta plastificata PP5, quindi una lucentezza leggera e non
 * un'opacità piatta. `depthWrite: false` perché è un piano appoggiato sul
 * vetro e scriverne la profondità farebbe sparire il vetro dietro.
 */
export const LABEL_MATERIAL = {
  roughness: 0.45,
  metalness: 0,
  transparent: true,
  depthWrite: false,
} as const;

/** ordine di disegno dell'etichetta: dopo vetro e tappo */
export const LABEL_RENDER_ORDER = 2;

/**
 * La birra dentro (spec 6.10). Opaca di proposito: si vede solo attraverso la
 * `transmission` del vetro, che la cattura nel suo render target e la
 * restituisce filtrata e già spenta dalle maschere. Come la tinta del vetro,
 * `#5a2a08` vive solo nel 3D e quindi sta qui e non in `COLORS`.
 *
 * Il profilo non è un numero di config: lo misura `prepareBottle` sulla cavità
 * del vetro vero. Qui c'è solo quanto staccarsene.
 */
export const LIQUID = {
  enabled: true,
  color: "#5a2a08",
  emissive: "#5a2a08",
  /** il "filo" di emissivo: basta a non farla sparire nel nero del vetro */
  emissiveIntensity: 0.12,
  roughness: 0.15,
  metalness: 0,
  /** livello della birra, spazio oggetto della bottiglia (spec 6.10) */
  fillY: 3.3,
  /**
   * Distanza dalla parete interna, in unità del modello. Il vetro ha due
   * pareti (spessore ≈ 0,055 sul corpo, 0,037 nel collo): il raggio × 0,93
   * della spec, preso sul profilo esterno, forerebbe quella interna.
   */
  gap: 0.008,
  /** passo dei campioni sul fondo, dall'asse verso il tallone */
  floorStep: 0.02,
  /** spicchi della `LatheGeometry`: tanto, da dietro un vetro scuro */
  segments: 32,
} as const;

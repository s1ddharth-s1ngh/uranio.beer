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

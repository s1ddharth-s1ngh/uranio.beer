// L'illuminazione, in numeri (spec 6.4).
//
// Il look da ottenere è quello di uno still life: vetro scuro quasi nero che
// vive di **riflessi lunghi**, non di luci puntiformi. Per questo l'ambiente
// conta più dei fari: due strisce verticali alte e strette a sinistra e a
// destra sono ciò che disegna le due lame di riflesso sul cilindro, e nessuna
// `PointLight` le può imitare.
//
// Sono valori di partenza: si regolano da `?debug` e si ricopiano qui.

import { COLORS } from "./theme.ts";

/**
 * L'env map fatta in casa: una scenetta di piani emissivi resa una volta in
 * una cubemap. Niente HDR da scaricare — sono megabyte per un riflesso che a
 * 256 px nessuno distingue.
 */
export const ENV = {
  resolution: 256,
  /** softbox grande sopra la bottiglia */
  top: { scale: [12, 12, 1], position: [0, 7, 0], intensity: 1.1, color: COLORS.white },
  /** le due strisce verticali: i riflessi lunghi sul vetro */
  sides: {
    scale: [0.7, 9, 1],
    x: 5,
    y: 1,
    z: 1.5,
    intensity: 2.2,
    color: COLORS.white,
  },
  /** rimbalzo caldo e debole dal basso, perché i neri non siano morti */
  bottom: {
    scale: [10, 6, 1],
    position: [0, -5, 2],
    intensity: 0.35,
    color: COLORS.redMid,
  },
} as const;

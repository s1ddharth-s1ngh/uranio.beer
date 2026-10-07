// Faro e piedistallo dell'hero (spec 6.7). Solo primitive: sono due oggetti
// nostri, di forma semplice, non modelli da scaricare.
//
// Le altezze sono **relative al pivot della protagonista**, come le bottiglie
// del carosello: la composizione dell'hero la decide l'ancora del keyframe, e
// tutto quello che le sta attorno la segue.

import { BOTTLE } from "./bottle.ts";
import { COLORS } from "./theme.ts";

export const PROPS = {
  /** il faro circolare sopra la bottiglia, tagliato dal bordo alto del frame */
  faro: {
    y: 3.9,
    z: 0.6,
    /** l'anello lucido */
    ringRadius: 1.6,
    ringTube: 0.06,
    /** il disco emissivo dentro l'anello */
    discRadius: 1.5,
    discIntensity: 2.4,
    discColor: "#FFF4E8",
    /** la scocca: un cilindro schiacciato in metallo scuro */
    shellRadius: 1.72,
    shellHeight: 0.22,
    shellColor: "#1A1A1A",
  },
  /** il piedistallo sotto la bottiglia */
  base: {
    /** appena sotto il fondo della bottiglia */
    y: -BOTTLE.centerY - 0.18,
    radius: 1.5,
    height: 0.36,
    color: "#0B0B0B",
    /** il filo emissivo sul bordo */
    rimTube: 0.014,
    rimColor: COLORS.red,
    rimIntensity: 1.8,
    /** il bagliore additivo sotto, un piano con gradiente */
    glowScale: 5.5,
    glowOpacity: 0.55,
  },
  /** uscita verso il primo piano (spec 6.7): il faro sale, il piedistallo scende */
  exitUp: 4,
  exitDown: 4,
} as const;

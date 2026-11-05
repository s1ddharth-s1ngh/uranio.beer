// Faro e piedistallo dell'anello (spec 6.7, riferimento ciaoenergy.com: il
// disco metallico in alto e la base sotto la lattina al centro). Solo
// primitive: sono due oggetti nostri, di forma semplice, non modelli da
// scaricare.
//
// Le altezze sono **relative al pivot della protagonista**, come le bottiglie
// dell'anello: la composizione la decide l'ancora del keyframe, e tutto
// quello che le sta attorno la segue.

import { BOTTLE } from "./bottle.ts";
import { COLORS } from "./theme.ts";

export const PROPS = {
  /** il faro sopra la bottiglia, tagliato dal bordo alto del frame */
  faro: {
    // con la camera dell'anello a 14,5 il bordo alto è ~3,25 sopra il
    // pivot: così ne spunta la metà bassa, dietro il logo dell'header, come
    // il disco del riferimento
    y: 3.05,
    z: 0.4,
    /** la scocca: un cilindro schiacciato in metallo scuro */
    shellRadius: 1.9,
    shellHeight: 0.34,
    shellColor: "#141414",
    /** tre anelli cromati concentrici sul fondo: prendono i riflessi */
    rings: [
      { radius: 1.86, tube: 0.07 },
      { radius: 1.42, tube: 0.05 },
      { radius: 0.98, tube: 0.04 },
    ],
    /** il disco che fa luce, dentro l'anello più piccolo */
    discRadius: 0.92,
    discColor: "#FFF4E8",
  },
  /** il piedistallo sotto la bottiglia */
  base: {
    /** appena sotto il fondo della bottiglia, che ci galleggia sopra */
    y: -BOTTLE.centerY - 0.32,
    radius: 1.55,
    height: 0.42,
    color: "#0B0B0B",
    /** i bordi cromati, sopra e sotto */
    chromeTube: 0.035,
    /** il filo rosso emissivo appena dentro il bordo alto */
    rimRadius: 1.32,
    rimTube: 0.012,
    rimColor: COLORS.red,
    /** il bagliore additivo sotto, un piano con gradiente */
    glowScale: 6,
    glowOpacity: 0.5,
  },
  /** uscita verso il primo piano: il faro sale, il piedistallo scende */
  exitUp: 5,
  exitDown: 5,
} as const;

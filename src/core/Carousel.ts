// La gamma: tutte le bottiglie in fila curva, allo step 5 (riferimento
// ciaoenergy.com, la fila di lattine). Ha preso il posto dell'anello
// trascinabile dell'hero: stessa idea di slot attorno alla protagonista, ma
// senza stato, perché la fila non si tocca e dipende solo da `p`.
//
// Niente DOM e niente three: le posizioni si provano in Node
// (`npm run verify:core`).

import { GAMMA } from "../config/beers.ts";

/** una posizione nella fila, in coordinate relative alla protagonista */
export interface SlotPose {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

/**
 * Rumore deterministico per slot: le inclinazioni devono essere varie ma
 * **sempre le stesse**. Con `Math.random()` la composizione cambierebbe a ogni
 * ricarica, e una composizione che cambia non si può né giudicare né
 * correggere.
 */
function seme(slot: number, canale: number): number {
  const x = Math.sin(slot * 12.9898 + canale * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Lo scarto dal centro dello slot `slot` su `count`: 0 la protagonista, poi a
 * coppie verso l'esterno, destra e sinistra (+1, −1, +2, −2…). Con un numero
 * pari l'ultima resta a destra.
 */
export function slotOffset(slot: number): number {
  return slot === 0 ? 0 : slot % 2 === 1 ? (slot + 1) / 2 : -slot / 2;
}

/**
 * Dove sta uno slot nella fila: sale verso destra in un arco che si piega in
 * basso ai due capi, e ogni bottiglia si inclina un po' di più in avanti
 * man mano che sale, così a sinistra si vedono i fondi e a destra i tappi.
 */
export function slotPose(slot: number, out: SlotPose): SlotPose {
  const i = slotOffset(slot);
  const g = GAMMA;
  out.x = i * g.spacing;
  out.y = i * g.rise - i * i * g.arc;
  out.z = -i * i * g.depth;
  out.rotX = i * g.twist;
  // la protagonista ha già la sua rotazione dal keyframe: la varietà è delle
  // altre
  out.rotY = slot === 0 ? 0 : (seme(slot, 1) - 0.5) * 2 * g.yawMax;
  out.rotZ = slot === 0 ? 0 : g.lean + (seme(slot, 2) - 0.5) * 2 * g.leanJitter;
  return out;
}

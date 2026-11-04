// Le altre bottiglie: l'anello dell'hero allo step 0 e la fila della gamma
// all'ultimo step (riferimento ciaoenergy.com, le lattine in cerchio
// all'apertura e in fila curva alla fine). Sono gli stessi cloni in due
// pose, mescolate da `layout`; niente stato, perché né l'anello né la fila si
// toccano e dipendono solo da `p`.
//
// Niente DOM e niente three: le posizioni si provano in Node
// (`npm run verify:core`).

import { GAMMA, RING } from "../config/beers.ts";

/** una posizione, in coordinate relative alla protagonista */
export interface SlotPose {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  /** quanto è spenta rispetto alle altre, 0–1 (1 = luminosità piena del keyframe) */
  dim: number;
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

/** da −1 a 1, deterministico */
const segnato = (slot: number, canale: number) => (seme(slot, canale) - 0.5) * 2;

/**
 * Lo scarto dal centro dello slot `slot`: 0 la protagonista, poi a coppie
 * verso l'esterno, destra e sinistra (+1, −1, +2, −2…). Con un numero pari
 * l'ultima resta a destra.
 */
export function slotOffset(slot: number): number {
  return slot === 0 ? 0 : slot % 2 === 1 ? (slot + 1) / 2 : -slot / 2;
}

/**
 * Dove sta uno slot nella fila della gamma: sale verso destra in un arco che
 * si piega in basso ai due capi, e ogni bottiglia si inclina un po' di più in
 * avanti man mano che sale, così a sinistra si vedono i fondi e a destra i
 * tappi.
 */
export function rowPose(slot: number, out: SlotPose): SlotPose {
  const i = slotOffset(slot);
  const g = GAMMA;
  out.x = i * g.spacing;
  out.y = i * g.rise - i * i * g.arc;
  out.z = -i * i * g.depth;
  out.rotX = i * g.twist;
  // la protagonista ha già la sua rotazione dal keyframe: la varietà è delle
  // altre
  out.rotY = slot === 0 ? 0 : segnato(slot, 1) * g.yawMax;
  out.rotZ = slot === 0 ? 0 : g.lean + segnato(slot, 2) * g.leanJitter;
  out.dim = 1;
  return out;
}

/**
 * Dove sta uno slot sull'anello dell'hero, con `ring` raggio e passo del
 * formato (`ringFor`). L'anello è tangente alla camera e sale verso destra;
 * le inclinazioni sono attorno a quella della protagonista, e chi gira verso
 * il fondo si spegne.
 */
export function ringPose(
  slot: number,
  ring: { radius: number; step: number },
  out: SlotPose,
): SlotPose {
  const i = slotOffset(slot);
  const a = i * ring.step;
  const j = RING.jitter;
  out.x = Math.sin(a) * ring.radius;
  out.z = (Math.cos(a) - 1) * ring.radius;
  out.y = out.x * RING.rise + (slot === 0 ? 0 : segnato(slot, 4) * j.y);
  if (slot === 0) {
    out.rotX = out.rotY = out.rotZ = 0;
  } else {
    out.rotX = segnato(slot, 5) * j.x;
    out.rotY = segnato(slot, 3) * j.yaw;
    out.rotZ = -Math.sign(i) * RING.fan + segnato(slot, 6) * j.z;
  }
  out.dim = Math.max(0, 1 - RING.depthDim * (1 - Math.cos(a)));
  return out;
}

const _anello: SlotPose = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
const _fila: SlotPose = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * La posa di uno slot fra anello (`layout` 0) e fila (`layout` 1). Il
 * passaggio avviene mentre le altre sono fuori scena (il retro), quindi il
 * mescolamento non si vede mai: serve a non avere un `if` che scatta.
 */
export function slotPose(
  slot: number,
  layout: number,
  ring: { radius: number; step: number },
  out: SlotPose,
): SlotPose {
  ringPose(slot, ring, _anello);
  rowPose(slot, _fila);
  out.x = mix(_anello.x, _fila.x, layout);
  out.y = mix(_anello.y, _fila.y, layout);
  out.z = mix(_anello.z, _fila.z, layout);
  out.rotX = mix(_anello.rotX, _fila.rotX, layout);
  out.rotY = mix(_anello.rotY, _fila.rotY, layout);
  out.rotZ = mix(_anello.rotZ, _fila.rotZ, layout);
  out.dim = mix(_anello.dim, _fila.dim, layout);
  return out;
}

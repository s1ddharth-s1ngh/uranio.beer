// La forma del volo del tappo come funzione di un numero, `cap` ∈ [0, 1]
// (0 chiuso, 1 sospeso). Lo scrive lo `StateMapper` da `p`: andata, ritorno e
// inversione a metà escono di conseguenza, come per tutto il resto. Niente
// three qui: i numeri si provano in Node (`npm run verify:core`), la
// geometria la fa `gl/Bottle.tsx`.

import { CAP_MOTION } from "../config/cap.ts";

export interface CapPose {
  /** salto lungo l'asse della bottiglia, in unità del modello */
  pop: number;
  /** 0 sul collo (più il salto), 1 al punto in cui resta sospeso */
  fly: number;
  /** giri sul proprio asse dovuti al volo, in radianti */
  spin: number;
  /** capriola di metà volo, in radianti */
  tumble: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** `back.out`: sale oltre e ricade, è lo scatto di un tappo che salta */
function backOut(x: number) {
  const c = 1.9;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function capPose(open: number, out: CapPose): CapPose {
  const o = clamp01(open);
  const m = CAP_MOTION;
  out.pop = m.pop * backOut(clamp01(o / m.popUntil));
  out.fly = smooth(m.flyFrom, 1, o);
  out.spin = o * m.spins * Math.PI * 2;
  out.tumble = Math.sin(o * Math.PI) * m.tumble;
  return out;
}

/**
 * Il bagliore alla bocca: una campana stretta attorno al momento del salto.
 * Vale 0 da chiuso e da sospeso, quindi a riposo non si disegna. La soglia è
 * un centesimo e non meno: la campana a `cap` 0 vale ancora 0,003, e sotto
 * una soglia più bassa lo sprite si sarebbe disegnato, invisibile, a ogni
 * frame dell'anello e del fronte.
 */
export function capFlash(open: number): number {
  const { at, width } = CAP_MOTION.flash;
  const d = (open - at) / width;
  const v = Math.exp(-d * d * 4);
  return v < 0.01 ? 0 : v;
}

// DPR adattivo (spec 6.1): se il frame medio supera 20 ms per 2 s, la scena
// scende di 0,25 di DPR, fino a 1. È la leva che costa meno qualità per più
// frame: i pixel da riempire calano col quadrato del DPR.
//
// Logica pura, senza DOM né R3F: la si prova in Node con tempi finti
// (`npm run verify:core`). La applica il `Driver` di `gl/Stage.tsx`.

import { ADAPTIVE_DPR } from "../config/theme.ts";

export class AdaptiveDpr {
  private warm = 0;
  private t = 0;
  private n = 0;

  /** Da capo, riscaldamento compreso: dopo un resize il DPR riparte dal tetto. */
  reset() {
    this.warm = 0;
    this.t = 0;
    this.n = 0;
  }

  /**
   * Un frame durato `delta` secondi, disegnato a `dpr`. Restituisce il DPR
   * nuovo, o `null` se resta quello.
   *
   * ponytail: solo in discesa. Una scena che rallenta per un attimo (un'altra
   * tab che macina, il primo giro del carosello) resta a DPR basso fino al
   * prossimo resize. La risalita (finestre veloci consecutive → +0,25, con
   * isteresi per non oscillare) è il passo successivo, se a occhio serve.
   */
  feed(delta: number, dpr: number): number | null {
    if (this.warm < ADAPTIVE_DPR.warmup) {
      this.warm += delta;
      return null;
    }
    this.t += delta;
    this.n++;
    if (this.t < ADAPTIVE_DPR.window) return null;
    const lenta = this.t / this.n > ADAPTIVE_DPR.slowFrame;
    this.t = 0;
    this.n = 0;
    if (!lenta || dpr <= ADAPTIVE_DPR.min) return null;
    return Math.max(ADAPTIVE_DPR.min, dpr - ADAPTIVE_DPR.step);
  }
}

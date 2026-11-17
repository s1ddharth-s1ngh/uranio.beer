// Il cursore, per far girare le bottiglie verso di lui.
//
// È l'unico ingresso della scena che non dipende da `p`, e resta fuori dallo
// `StateMapper` di proposito: lo stato di `p` è una funzione pura e si prova
// in Node, il cursore è un disturbo sommato sopra.
//
// L'influenza è locale: ogni bottiglia guarda dove sta lei sullo schermo e
// quanto il cursore le è vicino. Fino al 2026-11-17 il cursore girava tutta
// la scena insieme, anello compreso attorno alla protagonista: col mouse in
// giro per la pagina si muoveva tutto, sempre.

import * as THREE from "three";
import { POINTER } from "../config/pointer.ts";

const _e = new THREE.Euler();
const clamp1 = (x: number) => Math.min(1, Math.max(-1, x));

export class Pointer {
  /** il bersaglio, scritto dagli eventi: −1 a sinistra / in alto, +1 a destra / in basso */
  tx = 0;
  ty = 0;
  /** il valore smorzato che leggono le scene */
  x = 0;
  y = 0;
  /**
   * Quanto il cursore conta, 0–1, smorzato come la posizione: sale al primo
   * movimento del mouse, scende quando esce dalla finestra. Così fuori dalla
   * pagina le bottiglie tornano dritte piano, invece di girarsi tutte verso
   * il centro dello schermo dove il cursore "cadrebbe".
   */
  active = 0;
  private target = 0;
  /** larghezza / altezza della finestra, per misurare le distanze in tondo */
  aspect = 1;
  /**
   * La rotazione verso il cursore della protagonista, calcolata una volta per
   * frame da `gl/Stage.tsx` e letta dalla bottiglia e dalle luci, che devono
   * girare insieme o la faccia uscirebbe dal fascio.
   */
  readonly hero = new THREE.Quaternion();

  /**
   * Avanza lo smorzamento di `dt` secondi. Costante di tempo e non fattore per
   * frame: a 120 Hz un fattore fisso inseguirebbe il doppio più veloce.
   */
  update(dt: number) {
    const k = 1 - Math.exp(-dt / POINTER.tau);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.active += (this.target - this.active) * k;
  }

  /** Il cursore in coordinate della finestra, in px. */
  set(clientX: number, clientY: number, width: number, height: number) {
    this.tx = clamp1((clientX / width) * 2 - 1);
    this.ty = clamp1((clientY / height) * 2 - 1);
    this.aspect = height > 0 ? width / height : 1;
    this.target = 1;
  }

  /** Il cursore esce dalla finestra: l'influenza si spegne piano, dove sta. */
  release() {
    this.target = 0;
  }

  /** Da capo e fermo: al montaggio della scena e col moto ridotto. */
  reset() {
    this.target = this.active = 0;
    this.hero.identity();
  }

  /**
   * La rotazione che fa guardare verso il cursore una bottiglia che sta in
   * `sx, sy` sullo schermo (stesse coordinate del cursore: −1…1, y verso il
   * basso), pesata da quanto il cursore le è vicino. `amp` scala tutto: è
   * `SceneState.look` per la protagonista, per le altre il loro peso.
   *
   * In coordinate mondo: si moltiplica **a sinistra** della posa, così gira
   * verso il cursore qualunque parte della bottiglia stia guardando la camera
   * — il fronte allo step 1, il retro sul retro.
   */
  look(sx: number, sy: number, amp: number, out: THREE.Quaternion): THREE.Quaternion {
    const dx = (this.x - sx) * this.aspect;
    const dy = this.y - sy;
    const { sigma, reach } = POINTER;
    const w = this.active * amp * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    // il cursore sopra la bottiglia (dy < 0) alza la faccia: una rotazione
    // positiva attorno a x la porterebbe in basso
    _e.set(clamp1(dy / reach) * POINTER.pitch * w, clamp1(dx / reach) * POINTER.yaw * w, 0);
    return out.setFromEuler(_e);
  }

  /**
   * Ascolta il mouse sulla finestra. Solo il mouse: col dito il gesto è lo
   * scroll, e una bottiglia che si gira verso dove si è appena toccato
   * sembrerebbe un errore.
   */
  attach(win: Window): () => void {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      this.set(e.clientX, e.clientY, win.innerWidth, win.innerHeight);
    };
    const leave = (e: MouseEvent) => {
      if (!e.relatedTarget) this.release();
    };
    const blur = () => this.release();
    win.addEventListener("pointermove", move, { passive: true });
    win.document.addEventListener("mouseout", leave);
    win.addEventListener("blur", blur);
    return () => {
      win.removeEventListener("pointermove", move);
      win.document.removeEventListener("mouseout", leave);
      win.removeEventListener("blur", blur);
    };
  }
}

let shared: Pointer | undefined;

/** Un cursore per pagina: lo avanza `Stage.tsx`, lo leggono le scene. */
export function sharedPointer(): Pointer {
  shared ??= new Pointer();
  return shared;
}

// Il cursore per la parallasse (riferimento ciaoenergy.com): col mouse a
// destra la bottiglia gira un poco la faccia a destra, in alto a sinistra la
// alza verso l'alto a sinistra.
//
// È l'unico ingresso della scena che non dipende da `p`, e resta fuori dallo
// `StateMapper` di proposito: lo stato di `p` è una funzione pura e si prova
// in Node, il cursore è un disturbo sommato sopra, come la vita a riposo.

import * as THREE from "three";
import { POINTER } from "../config/pointer.ts";

export class Pointer {
  /** il bersaglio, scritto dagli eventi: −1 a sinistra / in alto, +1 a destra / in basso */
  tx = 0;
  ty = 0;
  /** il valore smorzato che leggono le scene */
  x = 0;
  y = 0;

  /**
   * Avanza lo smorzamento di `dt` secondi. Costante di tempo e non fattore per
   * frame: a 120 Hz un fattore fisso inseguirebbe il doppio più veloce.
   */
  update(dt: number) {
    const k = 1 - Math.exp(-dt / POINTER.tau);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
  }

  /** Il cursore in coordinate della finestra, in px. */
  set(clientX: number, clientY: number, width: number, height: number) {
    this.tx = Math.min(1, Math.max(-1, (clientX / width) * 2 - 1));
    this.ty = Math.min(1, Math.max(-1, (clientY / height) * 2 - 1));
  }

  /** Fuori dalla finestra si torna dritti, piano. */
  reset() {
    this.tx = 0;
    this.ty = 0;
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
      if (!e.relatedTarget) this.reset();
    };
    const blur = () => this.reset();
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

const _e = new THREE.Euler();

/**
 * La rotazione che fa guardare verso il cursore, in coordinate mondo: si
 * moltiplica **a sinistra** della posa, così gira verso il cursore qualunque
 * parte della bottiglia stia guardando la camera — il fronte allo step 1, il
 * retro sul retro. Sommata agli angoli di Euler della posa, invece, sul retro
 * la stessa spinta la farebbe guardare dall'altra parte.
 *
 * `amp` scala tutto: è `SceneState.look` per la protagonista, una frazione per
 * l'anello e la fila.
 */
export function lookQuaternion(
  ptr: { x: number; y: number },
  amp: number,
  out: THREE.Quaternion,
): THREE.Quaternion {
  // il mouse in alto (y < 0) alza la faccia: rotazione positiva attorno a x
  // porterebbe la faccia in basso
  _e.set(ptr.y * POINTER.pitch * amp, ptr.x * POINTER.yaw * amp, 0);
  return out.setFromEuler(_e);
}

let shared: Pointer | undefined;

/** Un cursore per pagina: lo avanza `Stage.tsx`, lo leggono le scene. */
export function sharedPointer(): Pointer {
  shared ??= new Pointer();
  return shared;
}

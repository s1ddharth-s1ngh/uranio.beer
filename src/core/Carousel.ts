// Il carosello dell'hero: la matematica dell'anello e lo stato del
// trascinamento (spec 6.6).
//
// Niente DOM e niente three: angoli, posizioni e inerzia si provano in Node
// (`npm run verify:core`). Gli ascoltatori dei gesti stanno nel componente,
// come per `StepController`.

import gsap from "gsap";
import { BEERS, CAROUSEL } from "../config/beers.ts";

/** una posizione sull'anello, in coordinate relative alla protagonista */
export interface SlotPose {
  /** angolo attorno all'asse verticale: 0 = davanti, al centro */
  angle: number;
  x: number;
  y: number;
  z: number;
  /** inclinazioni della bottiglia in quello slot */
  rotX: number;
  rotY: number;
  rotZ: number;
}

/**
 * Rumore deterministico per slot: le inclinazioni devono essere varie ma
 * **sempre le stesse**. Con `Math.random()` la composizione dell'hero
 * cambierebbe a ogni ricarica, e una composizione che cambia non si può né
 * giudicare né correggere.
 */
function seme(slot: number, canale: number): number {
  const x = Math.sin(slot * 12.9898 + canale * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Angolo di uno slot sull'anello. */
export function slotAngle(
  slot: number,
  active: number,
  rot: number,
  count: number,
): number {
  return ((slot - active) * (Math.PI * 2)) / count + rot;
}

/**
 * Posa completa di uno slot.
 *
 * `z = cos(a)·R − R` tiene la protagonista a z = 0 e manda indietro le altre:
 * l'anello non è centrato sull'origine ma **tangente** alla camera, così la
 * bottiglia al centro è sempre quella più vicina e più grande.
 */
export function slotPose(
  slot: number,
  active: number,
  rot: number,
  count: number,
  radius = CAROUSEL.radius,
): SlotPose {
  const angle = slotAngle(slot, active, rot, count);
  const { tilt } = CAROUSEL;
  // lo slot 0 è la protagonista: la sua posa è quella del keyframe dell'hero,
  // non una pescata dal seme
  const protagonista = slot === 0;
  return {
    angle,
    x: Math.sin(angle) * radius,
    y: protagonista ? 0 : (seme(slot, 4) - 0.5) * 2 * tilt.yOffsetMax,
    z: Math.cos(angle) * radius - radius,
    rotX: protagonista
      ? 0.22
      : tilt.xMin + seme(slot, 1) * (tilt.xMax - tilt.xMin),
    // ogni bottiglia mostra un pezzo diverso di etichetta
    rotY: protagonista ? 0 : seme(slot, 3) * Math.PI * 2,
    rotZ: protagonista ? 0.3 : (seme(slot, 2) - 0.5) * 2 * tilt.zMax,
  };
}

/** Il colore della rim light di uno slot: cicla sulle birre disponibili. */
export function slotBeer(slot: number, active: number) {
  const i = (((slot - active) % BEERS.length) + BEERS.length) % BEERS.length;
  return BEERS[i];
}

/**
 * Lo stato dell'anello: di quanto è girato e quale slot è davanti.
 *
 * `rot` e `active` sono ridondanti di proposito: `rot` è l'angolo continuo che
 * il dito muove, `active` lo slot agganciato. Dopo ogni aggancio i due si
 * rinormalizzano (`active` cambia di un passo e `rot` torna a zero) in modo
 * che la posa resti identica: è la stessa idea del modulo, ma senza perdere la
 * continuità durante il trascinamento.
 */
export class CarouselState {
  rot = 0;
  active = 0;
  dragging = false;
  /** radianti al secondo, stimati durante il trascinamento */
  velocity = 0;

  private tween: gsap.core.Tween | undefined;
  private lastT = 0;

  count: number;

  constructor(count: number = CAROUSEL.count) {
    this.count = count;
  }

  /**
   * Quante bottiglie sull'anello. Metodo e non campo pubblico: lo cambia il
   * componente al passaggio desktop↔mobile, e scrivere dentro un oggetto che
   * arriva dal render è esattamente ciò che `react-hooks/immutability`
   * impedisce — con ragione, perché un campo scritto durante il render
   * renderebbe il valore diverso a seconda di quando lo si legge.
   */
  setCount(n: number) {
    this.count = n;
  }

  get step(): number {
    return (Math.PI * 2) / this.count;
  }

  /** l'indice della birra al centro: lo legge lo slider dell'hero (task 8.19) */
  get index(): number {
    return (((this.active % BEERS.length) + BEERS.length) % BEERS.length);
  }

  grab(now: number) {
    this.tween?.kill();
    this.tween = undefined;
    this.dragging = true;
    this.velocity = 0;
    this.lastT = now;
  }

  /** `dx` in pixel: il verso è quello del dito */
  drag(dx: number, now: number) {
    if (!this.dragging) return;
    const d = dx * CAROUSEL.dragPerPixel;
    this.rot += d;
    const dt = (now - this.lastT) / 1000;
    // la velocità serve solo a decidere su quale slot agganciarsi: con dt
    // piccolissimi la divisione esplode, quindi sotto il millisecondo si
    // tiene l'ultima stima
    if (dt > 0.001) {
      this.velocity = d / dt;
      this.lastT = now;
    }
  }

  /**
   * Rilascio: si aggancia allo slot più vicino (spec 6.6), più uno se il
   * rilascio è uno scatto.
   *
   * Lo scatto vale **al massimo un passo in più**, non "la velocità per un
   * tempo di coda": così un colpetto corto e veloce porta avanti di uno come
   * uno si aspetta, ma una sbracciata non fa girare l'anello di tre bottiglie
   * oltre il punto dove il dito l'ha lasciato.
   */
  release() {
    if (!this.dragging) return;
    this.dragging = false;
    const vicino = Math.round(this.rot / this.step);
    const scatto =
      Math.abs(this.velocity) > CAROUSEL.flickVelocity
        ? Math.sign(this.velocity)
        : 0;
    this.snapTo(vicino + scatto);
  }

  /** Le frecce ai lati della protagonista: ±1 slot. */
  nudge(dir: number) {
    this.tween?.kill();
    this.dragging = false;
    this.velocity = 0;
    this.snapTo(-Math.sign(dir));
  }

  dispose() {
    this.tween?.kill();
    this.tween = undefined;
  }

  private snapTo(notch: number) {
    const to = notch * this.step;
    this.tween = gsap.to(this, {
      rot: to,
      duration: CAROUSEL.snapDuration,
      ease: "power3.out",
      onComplete: () => {
        // rinormalizzazione a posa invariata: `pose` dipende da
        // `(slot − active)·passo + rot`, quindi spostare `active` di −notch e
        // riportare `rot` a zero non muove niente di quello che si vede
        this.active -= notch;
        this.rot = 0;
        this.tween = undefined;
      },
    });
  }
}

let shared: CarouselState | undefined;

export function sharedCarousel(count?: number): CarouselState {
  shared ??= new CarouselState(count);
  return shared;
}

// Da `p` allo stato della scena (spec 7).
//
// Questa è la regola che tiene in piedi tutta l'esperienza: lo stato 3D è una
// **funzione pura** di `p`. Nessuno "anima verso" qualcosa; si calcola dove
// tutto deve stare per il valore di `p` di questo frame. Andata, ritorno,
// inversione a metà e salti con le icone escono di conseguenza, senza un ramo
// di codice per ciascuno.
//
// `apply()` non applica niente alla scena: restituisce lo stato e sono i
// moduli `gl/` a copiarlo nei loro oggetti. Così il mapper si esegue in Node
// (`npm run verify:core`) dove un WebGL non c'è.

import gsap from "gsap";
import * as THREE from "three";
import { SHADER } from "../config/bottle.ts";
import {
  FULL_WINDOW,
  KEYFRAMES,
  KEYFRAMES_MOBILE,
  SEGMENTS,
  type Group,
  type Keyframe,
} from "../config/keyframes.ts";
import { configureCamera, solvePivot } from "../config/solvePivot.ts";
import { EASE_WINDOW } from "../config/theme.ts";
import type { ViewportState } from "./Viewport.ts";

/** la curva dentro le finestre di coreografia; il tween di `p` ha già la sua */
const easeWindow = gsap.parseEase(EASE_WINDOW);

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Tempo locale di un gruppo dentro il segmento: fuori dalla finestra si ferma
 * agli estremi, dentro scorre da 0 a 1 con la curva di coreografia.
 *
 * Fuori da [0, 1] — cioè solo durante il rimbalzo ai bordi, che porta `p` a
 * −0,03 o a `last + 0,03` — si **extrapola in retta ignorando la finestra**:
 *
 * - extrapolare è necessario, o il rimbalzo non si vedrebbe (lo stato
 *   resterebbe incollato al keyframe del bordo);
 * - in retta perché le curve `inOut` di GSAP con argomento negativo tornano
 *   positive, e la bottiglia rimbalzerebbe nel verso sbagliato;
 * - ignorando la finestra perché un rimbalzo del 3% del segmento riscalato su
 *   una finestra di 0,8 diventerebbe un sobbalzo del 28%.
 */
export function windowEase(t: number, [start, end]: readonly [number, number]) {
  if (t < 0 || t > 1) return t;
  const tt = (t - start) / (end - start);
  return easeWindow(Math.min(1, Math.max(0, tt)));
}

export interface SceneState {
  /** il valore continuo che ha generato questo stato */
  p: number;
  camera: { position: THREE.Vector3; look: THREE.Vector3 };
  /** posizione del gruppo pivot della bottiglia protagonista */
  pivot: THREE.Vector3;
  rotation: THREE.Euler;
  /** intensità dello spot sul tappo */
  spot: number;
  uniforms: {
    reveal: number;
    revealY: number;
    focus: number;
    focusY: number;
    focusHalf: number;
    /** posizione della lama di luce, `SHADER.sweepIdle` quando è spenta */
    sweep: number;
    sweepAmt: number;
  };
  background: { hero: number; step: number; finale: number };
  carousel: {
    /** luminosità delle laterali */
    sideDim: number;
    /** 0 in posizione, 1 scappate fuori dal frame */
    escape: number;
  };
  /** 0 faro e piedistallo in scena, 1 usciti */
  props: number;
}

export class StateMapper {
  /**
   * Lo stato è un oggetto riusato, non uno nuovo a ogni frame: a 60 fps
   * sarebbero 60 oggetti al secondo da raccogliere, con tre `Vector3` dentro
   * (budget della sezione 9, task 8.27).
   */
  readonly state: SceneState = {
    p: 0,
    camera: { position: new THREE.Vector3(), look: new THREE.Vector3() },
    pivot: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    spot: 0,
    uniforms: {
      reveal: 0,
      revealY: SHADER.revealY,
      focus: 0,
      focusY: 0,
      focusHalf: 0,
      sweep: SHADER.sweepIdle,
      sweepAmt: 0,
    },
    background: { hero: 1, step: 0, finale: 0 },
    carousel: { sideDim: 0, escape: 0 },
    props: 0,
  };

  private kf: readonly Keyframe[] = KEYFRAMES;
  private pivots: THREE.Vector3[] = [];
  private cam = new THREE.PerspectiveCamera();
  private euler = new THREE.Euler();

  constructor(vp: ViewportState) {
    this.prepare(vp);
  }

  /** l'ultimo step: `p` vive in [0, last] */
  get last(): number {
    return this.kf.length - 1;
  }

  /**
   * Ricalcola i pivot di tutti i keyframe. Va rifatto a ogni resize: le ancore
   * sono in coordinate schermo, quindi la posizione nel mondo dipende da
   * quanto è larga la finestra (spec 7.1).
   */
  prepare(vp: ViewportState) {
    this.kf = vp.mobile ? KEYFRAMES_MOBILE : KEYFRAMES;
    for (let i = 0; i < this.kf.length; i++) {
      const k = this.kf[i];
      configureCamera(this.cam, k.camera, vp.aspect);
      this.euler.set(k.rotation[0], k.rotation[1], k.rotation[2]);
      this.pivots[i] = solvePivot(
        this.cam,
        this.euler,
        k.anchor,
        this.pivots[i] ?? new THREE.Vector3(),
      );
    }
    this.pivots.length = this.kf.length;
  }

  apply(p: number): SceneState {
    const k = Math.min(this.last - 1, Math.max(0, Math.floor(p)));
    // `t` può uscire da [0, 1]: col rimbalzo ai bordi `p` va a −0,03 e lo
    // stato va extrapolato, non congelato
    const t = p - k;
    const a = this.kf[k];
    const b = this.kf[k + 1];
    const seg = SEGMENTS[k];
    const w = (g: Group) => windowEase(t, seg.windows[g] ?? FULL_WINDOW);

    const s = this.state;
    s.p = p;

    const wCam = w("camera");
    for (let i = 0; i < 3; i++) {
      s.camera.position.setComponent(
        i,
        mix(a.camera.position[i], b.camera.position[i], wCam),
      );
      s.camera.look.setComponent(i, mix(a.camera.look[i], b.camera.look[i], wCam));
      s.pivot.setComponent(
        i,
        mix(this.pivots[k].getComponent(i), this.pivots[k + 1].getComponent(i), wCam),
      );
    }

    // Le rotazioni si interpolano come numeri e non come quaternioni: è
    // l'unico modo per far fare alla bottiglia un giro completo nello stesso
    // verso (0 → π → 2π). Un quaternione prenderebbe sempre la strada corta e
    // nel finale la bottiglia tornerebbe indietro.
    const wRot = w("rotazione");
    s.rotation.set(
      mix(a.rotation[0], b.rotation[0], wRot),
      mix(a.rotation[1], b.rotation[1], wRot),
      mix(a.rotation[2], b.rotation[2], wRot),
    );

    // lo spot segue la maschera della cima: si accendono e si spengono insieme
    const wReveal = w("reveal");
    s.spot = mix(a.spot, b.spot, wReveal);
    s.uniforms.reveal = mix(a.reveal, b.reveal, wReveal);
    s.uniforms.revealY = mix(a.revealY, b.revealY, wReveal);

    const wFocus = w("focus");
    s.uniforms.focus = mix(a.focus, b.focus, wFocus);
    s.uniforms.focusY = mix(a.focusY, b.focusY, wFocus);
    s.uniforms.focusHalf = mix(a.focusHalf, b.focusHalf, wFocus);

    // La lama di luce vive solo dentro la transizione: `sin(π·tt)` vale 0 ai
    // due estremi, quindi nelle pause si spegne da sé. Al contrario scorre
    // all'indietro gratis, perché è funzione di `p` come tutto il resto.
    const wSweep = w("sweep");
    const grezzo =
      Math.sin(Math.PI * Math.min(1, Math.max(0, wSweep))) * seg.sweepAmt;
    // `sin(π)` in virgola mobile non è zero ma 1e-16: senza questa soglia la
    // lama resterebbe formalmente accesa a ogni pausa e lo shader
    // continuerebbe a calcolarla
    const amt = grezzo < 1e-4 ? 0 : grezzo;
    s.uniforms.sweepAmt = amt;
    s.uniforms.sweep =
      amt === 0 ? SHADER.sweepIdle : mix(SHADER.sweepFrom, SHADER.sweepTo, wSweep);

    const wBg = w("sfondo");
    s.background.hero = mix(a.background[0], b.background[0], wBg);
    s.background.step = mix(a.background[1], b.background[1], wBg);
    s.background.finale = mix(a.background[2], b.background[2], wBg);

    const wLati = w("lati");
    s.carousel.sideDim = mix(a.sideDim, b.sideDim, wLati);
    s.carousel.escape = mix(a.escape, b.escape, wLati);
    s.props = mix(a.props, b.props, w("props"));

    return s;
  }
}

/**
 * Un solo mapper per pagina, come `sharedProgress()`: lo stato della scena è
 * uno, e due mapper vorrebbero dire due verità sullo stesso frame.
 */
let shared: StateMapper | undefined;

export function sharedMapper(vp: ViewportState): StateMapper {
  shared ??= new StateMapper(vp);
  return shared;
}

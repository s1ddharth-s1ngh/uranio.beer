// Unica fonte di verità per colori, durate ed easing: da qui li legge sia il
// TypeScript (shader, tween, materiali) sia il CSS, che li ricopia in
// `src/styles/tokens.css`. I due file devono restare allineati e c'è uno
// script che lo verifica a ogni build: `scripts/check-tokens.mjs`.

/**
 * Palette presa dai pixel dell'etichetta di Crisi Economica. Le chiavi
 * corrispondono una a una ai token `--u-*` di tokens.css.
 */
export const COLORS = {
  /** fondo pagina: nero non assoluto, così i neri della scena si staccano */
  black: "#050505",
  /** rosso dei fulmini: accento, fascia accesa, barra, icona attiva */
  red: "#DB4442",
  /** rosso smorzato: sfumature e rim light */
  redMid: "#A3302A",
  /** rosso cupo: ombre colorate */
  redDeep: "#6B1A12",
  /** centro dell'alone negli step */
  oxblood: "#3A0D0E",
  /** bordi dell'alone negli step */
  night: "#090303",
  /** ambra: seconda macchia del pavimento dell'hero e rim light alternate */
  amber: "#F2A33A",
  /** nebbia del finale, dal basso verso l'alto */
  fog1: "#DB4442",
  fog2: "#FF8A80",
  /** testi */
  white: "#F8F8F8",
} as const;

export type ColorName = keyof typeof COLORS;

/**
 * Durate delle transizioni fra step, in secondi (spec 5.2). Sono volutamente
 * più lente del riferimento: la regia è cinematografica, non reattiva.
 * L'indice è lo step di partenza, il valore la durata verso il successivo.
 */
export const STEP_DURATION = [
  1.6, // 0 hero → 1 primo piano
  1.4, // 1 primo piano → 2 retro F1
  1.2, // 2 F1 → 3 F2
  1.2, // 3 F2 → 4 F3
  1.2, // 4 F3 → 5 F4
  1.6, // 5 F4 → 6 finale
] as const;

/** l'ultimo step: `p` vive in [0, LAST_STEP] */
export const LAST_STEP = STEP_DURATION.length;

/**
 * Curva del tween di `p`: parte piano, accelera, atterra molto morbida.
 * Va registrata in GSAP come `CustomEase` col nome `uranio` (task 8.6).
 */
export const EASE_NAME = "uranio";
export const EASE_PATH = "M0,0 C0.65,0 0.18,1 1,1";

/** curva di default dentro le finestre di coreografia (spec 7.4) */
export const EASE_WINDOW = "power2.inOut";

/** Tempi del motore di scroll (spec 5.1). In millisecondi dove indicato. */
export const SCROLL = {
  /** oltre questa pausa un evento di rotella è un gesto nuovo, non inerzia */
  newGestureMs: 160,
  /** …oppure se il delta accelera di questo fattore */
  newGestureRatio: 1.5,
  /** …purché superi questa soglia in px, per non scattare sul rumore */
  newGestureMinPx: 12,
  /** accumulo che fa scattare lo step */
  triggerPx: 24,
  /** swipe: spostamento minimo in px */
  swipePx: 40,
  /** swipe: velocità minima in px/ms, per il flick corto */
  swipeVelocity: 0.3,
  /** salti con le icone: durata = base + extra × (distanza − 1), con tetto */
  jumpExtraPerStep: 0.35,
  jumpMaxDuration: 2.6,
  /** rimbalzo ai bordi */
  bounceAmount: 0.03,
  bounceDuration: 0.5,
} as const;

/** con `prefers-reduced-motion` tutto si appiattisce a questa durata */
export const REDUCED_DURATION = 0.45;

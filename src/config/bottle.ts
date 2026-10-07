// Le costanti della bottiglia, misurate sul GLB vero (spec 3.2–3.4).
//
// Tutto quello che c'è qui è stato riletto da `public/models/crisi_economica.glb`
// con three in Node, non copiato dalla spec: i numeri della spec combaciano,
// ma è questo file la fonte di verità del codice. `npm run verify:glb` li
// riverifica sul file a ogni giro.
//
// Niente numeri magici altrove (regola 10.1.4): chi ha bisogno di una misura
// della bottiglia la prende da qui.

/** il modello ottimizzato (task 8.4), 320 KB, nodi `vetro` / `tappo` / `etichetta` */
export const MODEL_URL = "/models/crisi_economica.glb";

/** i tre nodi, rinominati da `scripts/optimize-glb.mjs` */
export const NODES = ["vetro", "tappo", "etichetta"] as const;
export type NodeName = (typeof NODES)[number];

/** Ingombro verticale, in unità del modello (≈ 21 cm reali). */
export const BOTTLE = {
  minY: 0.0037,
  maxY: 4.1807,
  /**
   * Centro geometrico: `inner.position.y = -CENTER_Y` dentro il pivot, così
   * ogni rotazione gira attorno alla pancia e non attorno al fondo.
   */
  centerY: 2.0922,
  height: 4.177,
  /** raggio massimo del corpo cilindrico */
  bodyRadius: 0.656,
} as const;

/** Il tappo a corona: ci puntano lo spot e la maschera `reveal`. */
export const CAP = {
  minY: 4.0475,
  maxY: 4.1807,
  radius: 0.346,
} as const;

/**
 * L'etichetta avvolta e la sua texture.
 *
 * `scaleXZ`: il raggio dell'etichetta (0,651) è **sotto** quello del vetro
 * nella stessa fascia (0,656): senza questo fattore l'etichetta sta dentro il
 * vetro e il risultato è z-fighting o etichetta invisibile (spec 3.1).
 */
export const LABEL = {
  texture: { width: 2008, height: 827 },
  minY: 0.455,
  maxY: 1.7326,
  radius: 0.651,
  scaleXZ: 1.012,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
} as const;

/**
 * `v → y`, misurato per regressione su tutti i vertici dell'etichetta:
 * `y = 1.7327 − 1.2777 · v`. `v = 0` è il bordo **alto** della texture.
 */
export const LABEL_V_TO_Y = { top: 1.7327, span: 1.2777 } as const;

export function yFromV(v: number): number {
  return LABEL_V_TO_Y.top - LABEL_V_TO_Y.span * v;
}

/** `y → v`, l'inversa: serve al debug delle fasce (task 8.10). */
export function vFromY(y: number): number {
  return (LABEL_V_TO_Y.top - y) / LABEL_V_TO_Y.span;
}

/**
 * `u → angolo` attorno a Y, in gradi: 0° è verso la camera di default
 * (asse +Z), positivo verso +X. L'etichetta copre ~270° in due strisce, con
 * due spicchi di vetro nudo in mezzo (78°–113° e 235°–303°).
 *
 * Misurato sui vertici: u 0 → −57,1°; u 0,22 → +1,5° (il fronte guarda la
 * camera con `rotation.y = 0`); u 0,5 → 78,0°; u 0,55 → 113,2°; u 0,795 →
 * 180,2° (il retro, con `rotation.y = π`); u 1 → 235°.
 */
export const LABEL_U_TO_DEG = {
  front: { uMax: 0.5, deg0: -57, degSpan: 270 },
  back: { uMin: 0.55, deg0: 113, degSpan: 271 },
} as const;

export function degFromU(u: number): number {
  const { front, back } = LABEL_U_TO_DEG;
  return u <= front.uMax
    ? front.deg0 + front.degSpan * u
    : back.deg0 + back.degSpan * (u - back.uMin);
}

/** Per portare davanti una colonna `u`: `rotation.y = −θ(u)` in radianti. */
export function rotationYForU(u: number): number {
  return (-degFromU(u) * Math.PI) / 180;
}

/**
 * Le quattro fasce del retro (spec 3.4): i blocchi di testo che si accendono
 * uno per step. Le coordinate native sono i **pixel della texture**, perché è
 * lì che si leggono con un contagocce; l'altezza in unità del modello si
 * ricava dalla mappatura misurata sopra.
 */
function fascia(pxTop: number, pxBottom: number) {
  const alto = yFromV(pxTop / LABEL.texture.height);
  const basso = yFromV(pxBottom / LABEL.texture.height);
  return {
    px: [pxTop, pxBottom] as const,
    /** centro in unità del modello: va in `uFocusY` */
    y: (alto + basso) / 2,
    /** mezza altezza: va in `uFocusHalf` */
    half: (alto - basso) / 2,
  };
}

export const BANDS = {
  /** "ORDINARY BITTER" + ingredienti */
  f1: fascia(85, 200),
  /** "TRASFORMA LA CRISI IN PIACERE" + produttore */
  f2: fascia(218, 312),
  /** 4,2% Vol.alc, 33 cl, logo URANIO, pittogrammi */
  f3: fascia(335, 550),
  /** raccolta differenziata, scadenza, IG @uranio.beer */
  f4: fascia(565, 745),
} as const;

export type BandName = keyof typeof BANDS;
export const BAND_ORDER = ["f1", "f2", "f3", "f4"] as const;

/**
 * Valori di partenza degli uniform degli shader (spec 6.5). Le fasce sono
 * sul retro, quindi l'arco acceso è centrato su π.
 */
export const SHADER = {
  revealY: 3.0,
  revealSoft: 0.6,
  revealFloor: 0.4,
  focusSoft: 0.05,
  focusAngle: Math.PI,
  focusAngleHalf: 0.75,
  /** sfumatura ai bordi dell'arco acceso, in radianti */
  focusAngleSoft: 0.25,
  focusFloor: 0.06,
  focusGlowAmt: 0.35,
  /** la lama di luce entra ed esce da qui, in spazio normale */
  sweepFrom: -1.5,
  sweepTo: 1.5,
  sweepWidth: 0.16,
  /** parcheggio fuori campo quando non c'è nessuna transizione */
  sweepIdle: -2,
} as const;

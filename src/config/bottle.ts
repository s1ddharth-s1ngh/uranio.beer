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

/** Il tappo a corona: ci punta lo spot, ed è lui che salta via (`gl/Bottle.tsx`). */
export const CAP = {
  minY: 4.0475,
  maxY: 4.1807,
  radius: 0.346,
  /**
   * Il centro del tappo, in coordinate del modello: è attorno a questo punto
   * che il tappo gira quando si stacca (`gl/Bottle.tsx`). Il vetro finisce a
   * 4,139 e il tappo ne copre il labbro per 0,09: basta alzarlo di un decimo
   * perché sia fuori.
   */
  centerY: 4.1141,
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

/** il centro dell'etichetta in coordinate locali del pivot: l'ancora del fronte */
export const LABEL_CENTER_LOCAL = (LABEL.minY + LABEL.maxY) / 2 - BOTTLE.centerY;

/**
 * `v → y`, misurato per regressione su tutti i vertici dell'etichetta:
 * `y = 1.7327 − 1.2777 · v`. `v = 0` è il bordo **alto** della texture.
 */
export const LABEL_V_TO_Y = { top: 1.7327, span: 1.2777 } as const;

export function yFromV(v: number): number {
  return LABEL_V_TO_Y.top - LABEL_V_TO_Y.span * v;
}

/** `y → v`, l'inversa. */
export function vFromY(y: number): number {
  return (LABEL_V_TO_Y.top - y) / LABEL_V_TO_Y.span;
}

/**
 * `u → angolo` attorno a Y, in gradi: 0° è verso la camera di default
 * (asse +Z), positivo verso +X. L'etichetta copre ~270° in due strisce, con
 * due spicchi di vetro nudo in mezzo (81°–103° e 235°–303°).
 *
 * Misurato sui vertici: u 0 → −57,1°; u 0,22 → +1,5° (il fronte guarda la
 * camera con `rotation.y = 0`); u 0,5 → 78,0°; u 0,5116 → 81,2°, l'ultima
 * colonna del fronte; u 0,5136 → 103,4°, la prima del retro; u 0,795 →
 * 180,2° (il retro, con `rotation.y = π`); u 1 → 235°. Nella texture le due
 * strisce sono attaccate: la cucitura è fra quelle due colonne (`seamU`).
 * Fra i capi delle strisce e queste rette lo scarto arriva a 1,5°.
 */
export const LABEL_U_TO_DEG = {
  front: { deg0: -57, degSpan: 270 },
  back: { uMin: 0.55, deg0: 113, degSpan: 271 },
  seamU: 0.5126,
} as const;

export function degFromU(u: number): number {
  const { front, back, seamU } = LABEL_U_TO_DEG;
  return u < seamU
    ? front.deg0 + front.degSpan * u
    : back.deg0 + back.degSpan * (u - back.uMin);
}

/** Per portare davanti una colonna `u`: `rotation.y = −θ(u)` in radianti. */
export function rotationYForU(u: number): number {
  return (-degFromU(u) * Math.PI) / 180;
}

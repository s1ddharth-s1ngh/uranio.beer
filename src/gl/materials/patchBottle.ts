// Gli shader della bottiglia (spec 6.5): cima accesa, fascia accesa, lama di
// luce.
//
// Sono tre maschere moltiplicative innestate nel materiale standard di three
// con `onBeforeCompile`, non tre materiali nuovi: il vetro fisico, il metallo
// del tappo e l'etichetta devono continuare a illuminarsi come li illumina
// three — l'ambiente, lo spot, le rim light — e queste maschere decidono solo
// **quanta** di quella luce resta.
//
// Tutte e tre leggono `vObjPos`, la posizione del vertice in spazio oggetto.
// È per questo che `prepareBottle()` porta le tre mesh nello stesso spazio:
// qui "y = 1,5" deve voler dire la stessa altezza per il vetro, per il tappo e
// per l'etichetta.

import * as THREE from "three";
import { SHADER } from "../../config/bottle.ts";
import { FACE } from "../../config/lights.ts";
import { COLORS } from "../../config/theme.ts";

export interface BottleUniforms {
  uReveal: { value: number };
  uRevealY: { value: number };
  uRevealSoft: { value: number };
  uRevealFloor: { value: number };
  uFocus: { value: number };
  uFocusY: { value: number };
  uFocusHalf: { value: number };
  uFocusSoft: { value: number };
  uFocusAngle: { value: number };
  uFocusAngleHalf: { value: number };
  uFocusAngleSoft: { value: number };
  uFocusFloor: { value: number };
  uFocusGlow: { value: THREE.Color };
  uFocusGlowAmt: { value: number };
  uFocusHot: { value: number };
  uFocusHalo: { value: number };
  uSweep: { value: number };
  uSweepWidth: { value: number };
  uSweepAmt: { value: number };
  uDim: { value: number };
  uFace: { value: number };
  uFaceDir: { value: THREE.Vector3 };
  uFaceColor: { value: THREE.Color };
}

/**
 * Un oggetto uniform per bottiglia: nel carosello i materiali sono cloni che
 * condividono geometrie e texture, ma ognuno ha la sua luce (la protagonista
 * usa reveal, focus e sweep; le laterali solo `uDim`).
 */
export function createBottleUniforms(): BottleUniforms {
  return {
    uReveal: { value: 0 },
    uRevealY: { value: SHADER.revealY },
    uRevealSoft: { value: SHADER.revealSoft },
    uRevealFloor: { value: SHADER.revealFloor },
    uFocus: { value: 0 },
    uFocusY: { value: 0 },
    uFocusHalf: { value: 0 },
    uFocusSoft: { value: SHADER.focusSoft },
    uFocusAngle: { value: SHADER.focusAngle },
    uFocusAngleHalf: { value: SHADER.focusAngleHalf },
    uFocusAngleSoft: { value: SHADER.focusAngleSoft },
    uFocusFloor: { value: SHADER.focusFloor },
    uFocusGlow: { value: new THREE.Color(COLORS.red) },
    uFocusGlowAmt: { value: SHADER.focusGlowAmt },
    uFocusHot: { value: SHADER.focusHot },
    uFocusHalo: { value: SHADER.focusHalo },
    uSweep: { value: SHADER.sweepIdle },
    uSweepWidth: { value: SHADER.sweepWidth },
    uSweepAmt: { value: 0 },
    uDim: { value: 1 },
    uFace: { value: 0 },
    uFaceDir: { value: new THREE.Vector3(...FACE.direction).normalize() },
    uFaceColor: { value: new THREE.Color(FACE.color) },
  };
}

/**
 * Le maschere guidate da `p` (le scrive `StateMapper`). La forma è la stessa
 * di `SceneState["uniforms"]`, ma dichiarata qui: questo modulo non deve
 * sapere niente del motore di scroll.
 */
export interface BottleMasks {
  reveal: number;
  revealY: number;
  focus: number;
  focusY: number;
  focusHalf: number;
  focusAngleHalf: number;
  sweep: number;
  sweepAmt: number;
}

/**
 * Copia le maschere negli uniform. Funzione e non metodo di un oggetto React:
 * così il componente non scrive mai dentro un valore che gli arriva dal
 * render, e la regola `react-hooks/immutability` resta contenta senza
 * mettere di mezzo un ref per ogni frame.
 */
export function applyMasks(u: BottleUniforms, m: BottleMasks, dim = 1, face = 0) {
  u.uReveal.value = m.reveal;
  u.uRevealY.value = m.revealY;
  u.uFocus.value = m.focus;
  u.uFocusY.value = m.focusY;
  u.uFocusHalf.value = m.focusHalf;
  u.uFocusAngleHalf.value = m.focusAngleHalf;
  u.uSweep.value = m.sweep;
  u.uSweepAmt.value = m.sweepAmt;
  u.uDim.value = dim;
  u.uFace.value = face;
}

/**
 * Le costanti regolabili a occhio dal pannello (task 8.5): quanto è sfumato
 * il bordo di una fascia, quanto resta acceso il resto della bottiglia. Non ci
 * sono `reveal`, `focus` e `focusY`, che li guida `p`.
 */
export const TUNABLE = {
  revealY: "uRevealY",
  revealSoft: "uRevealSoft",
  revealFloor: "uRevealFloor",
  focusSoft: "uFocusSoft",
  focusAngleSoft: "uFocusAngleSoft",
  focusFloor: "uFocusFloor",
  focusGlowAmt: "uFocusGlowAmt",
  focusHot: "uFocusHot",
  focusHalo: "uFocusHalo",
  sweepWidth: "uSweepWidth",
} as const;

export type Tuning = Record<keyof typeof TUNABLE, number>;

export function readTuning(u: BottleUniforms): Tuning {
  const out = {} as Tuning;
  for (const [nome, chiave] of Object.entries(TUNABLE) as [keyof Tuning, string][]) {
    out[nome] = (u[chiave as keyof BottleUniforms] as { value: number }).value;
  }
  return out;
}

export function applyTuning(u: BottleUniforms, t: Tuning) {
  for (const [nome, chiave] of Object.entries(TUNABLE) as [keyof Tuning, string][]) {
    (u[chiave as keyof BottleUniforms] as { value: number }).value = t[nome];
  }
}

/** i limiti delle manopole nel pannello */
export const TUNING_RANGE: Record<keyof Tuning, { min: number; max: number; step: number }> = {
  revealY: { min: 0, max: 4.2, step: 0.01 },
  revealSoft: { min: 0.01, max: 2, step: 0.01 },
  revealFloor: { min: 0, max: 1, step: 0.01 },
  focusSoft: { min: 0.005, max: 0.5, step: 0.005 },
  focusAngleSoft: { min: 0.01, max: 1, step: 0.01 },
  focusFloor: { min: 0, max: 1, step: 0.01 },
  focusGlowAmt: { min: 0, max: 2, step: 0.01 },
  focusHot: { min: 0, max: 1, step: 0.01 },
  focusHalo: { min: 0, max: 0.5, step: 0.005 },
  sweepWidth: { min: 0.02, max: 1, step: 0.01 },
};

/** i marcatori di three su cui si innesta la patch: se cambiano, si fallisce */
export const MARKERS = {
  common: "#include <common>",
  beginVertex: "#include <begin_vertex>",
  dithering: "#include <dithering_fragment>",
} as const;

const DECL_VERTEX = `${MARKERS.common}
varying vec3 vObjPos;`;

const DECL_FRAGMENT = `${MARKERS.common}
varying vec3 vObjPos;
uniform float uReveal, uRevealY, uRevealSoft, uRevealFloor;
uniform float uFocus, uFocusY, uFocusHalf, uFocusSoft;
uniform float uFocusAngle, uFocusAngleHalf, uFocusAngleSoft, uFocusFloor, uFocusGlowAmt;
uniform float uFocusHot, uFocusHalo;
uniform vec3 uFocusGlow;
uniform float uSweep, uSweepWidth, uSweepAmt, uDim;
uniform float uFace;
uniform vec3 uFaceDir, uFaceColor;`;

/**
 * Il corpo della patch.
 *
 * Si innesta su `dithering_fragment`, l'ultima riga del materiale. La spec
 * voleva le maschere in spazio display, dopo tone mapping e color space: è
 * così solo se si disegna direttamente sullo schermo. Col post-processing la
 * scena va in una render target, three salta tone mapping e conversione e il
 * materiale scrive valori **lineari**; la conversione la fa il composer alla
 * fine. Quindi le soglie (`focusFloor`, `revealFloor`) sono in lineare: 0,06
 * lineare a schermo è ~0,27, cioè il resto dell'etichetta ben leggibile
 * accanto alla fascia, che è il motivo per cui il pavimento ora è 0,015
 * (~0,13 a schermo, visto il 2026-11-04).
 */
function body(isLabel: boolean): string {
  return `
  // --- cima accesa: sotto uRevealY la luce scende fino al pavimento
  float revealLit = smoothstep(uRevealY - uRevealSoft, uRevealY + uRevealSoft, vObjPos.y);
  float reveal = mix(1.0, mix(uRevealFloor, 1.0, revealLit), uReveal);

  // --- fascia accesa: una finestra in altezza per una finestra in angolo.
  // L'angolo si confronta passando per seno e coseno, non per sottrazione:
  // attorno a ±π la differenza diretta salta di 2π e la fascia si spezzerebbe
  // esattamente dove serve, sul retro della bottiglia.
  float ang = atan(vObjPos.x, vObjPos.z);
  float dAng = abs(atan(sin(ang - uFocusAngle), cos(ang - uFocusAngle)));
  float dY = abs(vObjPos.y - uFocusY);
  float band = (1.0 - smoothstep(uFocusHalf, uFocusHalf + uFocusSoft, dY))
             * (1.0 - smoothstep(uFocusAngleHalf, uFocusAngleHalf + uFocusAngleSoft, dAng));
  // la fascia come la colpirebbe un faretto e non una tendina: più chiara al
  // centro del blocco, un filo più spenta verso i bordi. In coordinate
  // normalizzate sul blocco, così la forma è la stessa per ogni fascia
  vec2 qB = vec2(dAng / max(uFocusAngleHalf, 1e-3), dY / max(uFocusHalf, 1e-3));
  float hot = exp(-dot(qB, qB) * 0.9);
  band *= mix(1.0 - 0.5 * uFocusHot, 1.0 + uFocusHot, hot);
  float focus = mix(1.0, mix(uFocusFloor, 1.0, band), uFocus);

${
  isLabel
    ? `  // la luce sulla faccia (riferimento ciaoenergy.com, la lattina dello
  // step "fronte"): un Lambert da destra in alto, solo sull'etichetta. Qui e
  // non con una luce in scena: una luce vera si paga in ogni pixel di ogni
  // materiale, vetro e copie comprese, anche spenta. La normale è in spazio
  // vista, e la camera guarda sempre dritto: la direzione è costante
  gl_FragColor.rgb += uFace * uFaceColor * diffuseColor.rgb * max(dot(normal, uFaceDir), 0.0);
`
    : ""
}
  gl_FragColor.rgb *= reveal * focus * uDim;
  // l'alone: la luce colorata che sborda dal blocco sulla superficie attorno,
  // larga il doppio del blocco. È lei a far sembrare la fascia illuminata da
  // fuori invece che stampata più chiara
  float halo = exp(-dot(qB, qB) * 0.35) * (1.0 - min(band, 1.0) * 0.6);
  gl_FragColor.rgb += halo * uFocusGlow * uFocusHalo * uFocus * uDim;
${
  isLabel
    ? `  // dentro la fascia i pixel chiari dell'etichetta prendono un bagliore
  // rosso: è il testo che brilla, non il supporto
  gl_FragColor.rgb += uFocusGlow * uFocusGlowAmt * uFocus * band * dot(gl_FragColor.rgb, vec3(0.333));
`
    : ""
}
  // --- lama di luce. In un cilindro che gira sul proprio asse i riflessi
  // dell'ambiente stanno fermi, quindi la luce che "viaggia" durante le
  // rotazioni va simulata. \`d * d\` e non \`pow(d, 2.0)\`: in GLSL \`pow\` con
  // base negativa è indefinito, e qui la base è negativa su mezza bottiglia.
  float sweepD = (normal.x - uSweep) / uSweepWidth;
  gl_FragColor.rgb += vec3(exp(-sweepD * sweepD) * uSweepAmt) * (0.6 + 0.4 * reveal);

${MARKERS.dithering}`;
}

/**
 * Innesta le maschere in un materiale. Da chiamare prima della prima
 * compilazione (cioè prima che il materiale venga disegnato).
 */
export function patchBottleMaterial(
  mat: THREE.Material,
  u: BottleUniforms,
  isLabel = false,
) {
  // Senza questa chiave three riuserebbe il programma già compilato di un
  // altro materiale standard con le stesse opzioni, patch compresa o esclusa a
  // caso: due varianti diverse (con e senza bagliore) devono restare due.
  mat.customProgramCacheKey = () => (isLabel ? "bottle-label" : "bottle-surface");
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = inserisci(
      shader.vertexShader,
      [
        [MARKERS.common, DECL_VERTEX],
        [MARKERS.beginVertex, `${MARKERS.beginVertex}\n  vObjPos = position;`],
      ],
      "vertex",
    );
    shader.fragmentShader = inserisci(
      shader.fragmentShader,
      [
        [MARKERS.common, DECL_FRAGMENT],
        [MARKERS.dithering, body(isLabel)],
      ],
      "fragment",
    );
  };
}

/**
 * Sostituzione con controllo. Le API di three cambiano spesso (regola 10.1.5)
 * e il giorno in cui un `#include` cambia nome la patch sparirebbe in
 * silenzio: la bottiglia resterebbe illuminata per intero e nessuno capirebbe
 * perché le fasce non si accendono più.
 */
function inserisci(
  src: string,
  sostituzioni: readonly (readonly [string, string])[],
  dove: string,
): string {
  let out = src;
  for (const [marker, replacement] of sostituzioni) {
    if (!out.includes(marker)) {
      throw new Error(
        `patchBottleMaterial: "${marker}" non c'è più nello shader ${dove} di three ` +
          `${THREE.REVISION}. Gli shader della bottiglia (spec 6.5) vanno riagganciati.`,
      );
    }
    out = out.replace(marker, replacement);
  }
  return out;
}

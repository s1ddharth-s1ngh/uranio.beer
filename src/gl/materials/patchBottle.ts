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
  uSweep: { value: number };
  uSweepWidth: { value: number };
  uSweepAmt: { value: number };
  uDim: { value: number };
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
    uSweep: { value: SHADER.sweepIdle },
    uSweepWidth: { value: SHADER.sweepWidth },
    uSweepAmt: { value: 0 },
    uDim: { value: 1 },
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
  sweep: number;
  sweepAmt: number;
}

/**
 * Copia le maschere negli uniform. Funzione e non metodo di un oggetto React:
 * così il componente non scrive mai dentro un valore che gli arriva dal
 * render, e la regola `react-hooks/immutability` resta contenta senza
 * mettere di mezzo un ref per ogni frame.
 */
export function applyMasks(u: BottleUniforms, m: BottleMasks, dim = 1) {
  u.uReveal.value = m.reveal;
  u.uRevealY.value = m.revealY;
  u.uFocus.value = m.focus;
  u.uFocusY.value = m.focusY;
  u.uFocusHalf.value = m.focusHalf;
  u.uSweep.value = m.sweep;
  u.uSweepAmt.value = m.sweepAmt;
  u.uDim.value = dim;
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
  focusAngleHalf: "uFocusAngleHalf",
  focusAngleSoft: "uFocusAngleSoft",
  focusFloor: "uFocusFloor",
  focusGlowAmt: "uFocusGlowAmt",
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
  focusAngleHalf: { min: 0.1, max: Math.PI, step: 0.01 },
  focusAngleSoft: { min: 0.01, max: 1, step: 0.01 },
  focusFloor: { min: 0, max: 1, step: 0.01 },
  focusGlowAmt: { min: 0, max: 2, step: 0.01 },
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
uniform vec3 uFocusGlow;
uniform float uSweep, uSweepWidth, uSweepAmt, uDim;`;

/**
 * Il corpo della patch.
 *
 * Si innesta su `dithering_fragment`, cioè **dopo** tone mapping e color
 * space: le maschere moltiplicano un colore già in spazio display. È quello
 * che chiede la spec e in questo caso è anche comodo — spegnere in spazio
 * display somiglia più a una tendina che si chiude che a una luce che cala,
 * ed è l'effetto che serve.
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
  float band = (1.0 - smoothstep(uFocusHalf, uFocusHalf + uFocusSoft, abs(vObjPos.y - uFocusY)))
             * (1.0 - smoothstep(uFocusAngleHalf, uFocusAngleHalf + uFocusAngleSoft, dAng));
  float focus = mix(1.0, mix(uFocusFloor, 1.0, band), uFocus);

  gl_FragColor.rgb *= reveal * focus * uDim;
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

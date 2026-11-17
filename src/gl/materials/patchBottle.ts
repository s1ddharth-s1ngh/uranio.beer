// Gli shader della bottiglia: due ritocchi alla luce di three, niente di più.
//
// Fino al 2026-11-17 qui c'erano tre maschere (cima accesa, fascia accesa,
// lama di luce) che spegnevano la bottiglia per accenderne un pezzo: al
// proprietario sembravano finte ("non è per nulla naturale, non è per nulla
// professionale") e costavano `atan`, `sin`, `cos` ed `exp` in ogni pixel di
// ogni bottiglia. Sono rimasti solo:
//
// - `uDim`: quanto è accesa una bottiglia. Le laterali dell'anello sono in
//   penombra, e all'ingresso la protagonista si accende mentre sale;
// - `uFace`: la luce calda sull'etichetta, da destra in alto. Un termine nello
//   shader e non una luce in scena: una luce vera si paga in ogni pixel di
//   ogni materiale, vetro e copie comprese, anche spenta.

import * as THREE from "three";
import { FACE } from "../../config/lights.ts";

export interface BottleUniforms {
  uDim: { value: number };
  uFace: { value: number };
  uFaceDir: { value: THREE.Vector3 };
  uFaceColor: { value: THREE.Color };
}

/**
 * Un oggetto uniform per bottiglia: nel carosello i materiali sono cloni che
 * condividono geometrie e texture, ma ognuno ha la sua luce.
 */
export function createBottleUniforms(): BottleUniforms {
  return {
    uDim: { value: 1 },
    uFace: { value: 0 },
    uFaceDir: { value: new THREE.Vector3(...FACE.direction).normalize() },
    uFaceColor: { value: new THREE.Color(FACE.color) },
  };
}

/**
 * Scrive la luce negli uniform. Funzione e non metodo di un oggetto React:
 * così il componente non scrive mai dentro un valore che gli arriva dal
 * render (regola `react-hooks/immutability`).
 */
export function setBottleLight(u: BottleUniforms, dim: number, face = 0) {
  u.uDim.value = dim;
  u.uFace.value = face;
}

/** i marcatori di three su cui si innesta la patch: se cambiano, si fallisce */
export const MARKERS = {
  common: "#include <common>",
  tonemapping: "#include <tonemapping_fragment>",
} as const;

const DECL_FRAGMENT = `${MARKERS.common}
uniform float uDim, uFace;
uniform vec3 uFaceDir, uFaceColor;`;

/**
 * Il corpo della patch, **prima** del tone mapping e della conversione in
 * sRGB: qui `gl_FragColor` è ancora luce lineare, quindi `uDim` dimezza la
 * luce davvero e il termine della faccia si somma come si sommerebbe una
 * luce. Prima c'era il post-processing e la scena finiva in una render target
 * lineare; ora si disegna sullo schermo, e dopo `colorspace_fragment` le
 * stesse operazioni lavorerebbero in sRGB.
 */
function body(isLabel: boolean): string {
  const faccia = isLabel
    ? // la normale è in spazio vista e la camera guarda sempre dritto: la
      // direzione della luce sulla faccia è costante
      `  gl_FragColor.rgb += uFace * uFaceColor * diffuseColor.rgb * max(dot(normal, uFaceDir), 0.0);\n`
    : "";
  return `${faccia}  gl_FragColor.rgb *= uDim;
${MARKERS.tonemapping}`;
}

/**
 * Innesta la luce in un materiale. Da chiamare prima della prima
 * compilazione (cioè prima che il materiale venga disegnato).
 */
export function patchBottleMaterial(
  mat: THREE.Material,
  u: BottleUniforms,
  isLabel = false,
) {
  // Senza questa chiave three riuserebbe il programma già compilato di un
  // altro materiale standard con le stesse opzioni, patch compresa o esclusa a
  // caso: due varianti diverse (con e senza faccia) devono restare due.
  mat.customProgramCacheKey = () => (isLabel ? "bottle-label" : "bottle-surface");
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = inserisci(
      shader.fragmentShader,
      [
        [MARKERS.common, DECL_FRAGMENT],
        [MARKERS.tonemapping, body(isLabel)],
      ],
      "fragment",
    );
  };
}

/**
 * Sostituzione con controllo. Le API di three cambiano spesso (regola 10.1.5)
 * e il giorno in cui un `#include` cambia nome la patch sparirebbe in
 * silenzio: le laterali dell'anello resterebbero accese quanto la
 * protagonista e nessuno capirebbe perché.
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
          `${THREE.REVISION}. La luce della bottiglia va riagganciata.`,
      );
    }
    out = out.replace(marker, replacement);
  }
  return out;
}

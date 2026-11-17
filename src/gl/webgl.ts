/**
 * Un rasterizzatore software: WebGL c'è, ma lo disegna la CPU. Succede con un
 * driver rotto o in lista nera, in una macchina virtuale, in Chrome senza GPU.
 */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * WebGL2 c'è, e lo disegna una GPU? Il contesto di prova si rilascia subito:
 * i browser ne tengono pochi aperti, e questo occuperebbe il posto di quello
 * vero.
 *
 * Il software conta come "niente WebGL" (2026-11-17): misurata con
 * SwiftShader a 1366×768, la scena andava a 5–10 fps anche dopo tutte le
 * ottimizzazioni, cioè a scatti su qualunque PC dovesse ricadere lì; la
 * versione statica almeno si legge e si scorre. Dove il nome della GPU non si
 * può leggere (Firefox con la protezione dal fingerprinting) si presume
 * l'hardware.
 */
export function hasHardwareWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !SOFTWARE.test(gpu);
  } catch {
    return false;
  }
}

/**
 * WebGL2 c'è? Il contesto di prova si rilascia subito: i browser ne tengono
 * pochi aperti, e questo occuperebbe il posto di quello vero.
 */
export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

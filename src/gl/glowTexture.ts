import * as THREE from "three";

/**
 * Un bagliore radiale generato a runtime, non un file: un gradiente su una
 * canvas 2D costa una volta sola e risparmia una richiesta di rete e un
 * asset da tenere allineato alla palette. Si usa additivo, così si somma a
 * quello che c'è sotto invece di coprirlo.
 */
export function makeGlowTexture(stops: readonly (readonly [number, string])[]): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

import * as THREE from "three";

// Materiale CROMO LUCIDO condiviso dalle mesh dell'hero (lettere + emblema del
// logo Uranio). Look "liquid chrome" stile oobexr: specchio pulito che riflette
// un ambiente cielo-chiaro/terra-scura → ogni lettera è argento brillante in
// alto e scura in basso, con la banda netta dell'orizzonte sulla faccia.
// Estratto dal vecchio KickModel così UranioLogo non duplica il materiale.
//
// SUPERFICIE LISCIA, senza normal map: la vecchia normal map "a onde" creava
// righe/venature orizzontali che non piacevano — rimossa. Il carattere cromato
// viene TUTTO dal riflesso dell'<Environment> (vedi makeHorizonTexture in
// HeroScene), non da texture sulla superficie. Il contrasto forte cielo/terra
// (non l'intensità pura) è ciò che lo fa leggere come cromo e non come bianco
// pieno abbagliante.
export const chromeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, // neutro: è il riflesso a dare il colore
  metalness: 1,
  roughness: 0.08, // specchio quasi perfetto → riflesso nitido del gradiente
  envMapIntensity: 1.1,
  clearcoat: 1, // strato lucido "bagnato" sopra il metallo
  clearcoatRoughness: 0.06,
});

// Genera UV via proiezione box per le geometrie che non le hanno (SVG estrusi,
// mesh grezze). Tenuto anche senza normal map: è innocuo e lascia il materiale
// pronto a eventuali mappe future.
export function ensureUVs(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute("uv")) return;
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!pos || !nor) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const scale =
    1 /
    (Math.max(
      bb.max.x - bb.min.x,
      bb.max.y - bb.min.y,
      bb.max.z - bb.min.z,
    ) || 1);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

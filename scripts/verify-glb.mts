// Verifica del GLB ottimizzato, senza browser: carica il file vero in Node ed
// esegue la logica vera dei consumatori. È il "fatto quando" del task 8.4
// tradotto in numeri — "identico a occhio" da qui non si può affermare, ma
// "stessa geometria, stesse misure, tappo ancora tondo" sì.
//
//   npm run verify:glb

import fs from "node:fs";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  buildBottleAssembly,
  splitBottleGlb,
} from "../src/components/about/bottleAssembly.ts";

const SRC = "assets-src/Crisi_Economica_etichettata.glb";
const DST = "public/models/crisi_economica.glb";

// In Node non c'è DOM: GLTFLoader crea Blob URL per le texture e le carica con
// l'Image del browser. Qui le texture non servono — si misura geometria —
// quindi si stuba il minimo per non farlo esplodere.
(globalThis as unknown as { self: unknown }).self = globalThis;
THREE.TextureLoader.prototype.load = function (_url, onLoad) {
  const t = new THREE.Texture();
  t.image = { width: 1, height: 1 };
  if (onLoad) onLoad(t);
  return t;
};

async function carica(file: string): Promise<THREE.Group> {
  const buf = fs.readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(
    buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer,
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** vertici di un sottoalbero, in spazio mondo */
function vertici(root: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      out.push(
        new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld),
      );
    }
  });
  return out;
}

/**
 * Rotondità della silhouette. Non la dispersione dei vertici — quella dipende
 * da quanti ne restano e direbbe che meno vertici è sempre peggio — ma
 * l'inviluppo: il raggio massimo in ciascuno di 180 spicchi. È quello che
 * disegna il bordo ed è quello che l'occhio giudica. Un tappo poligonato ha un
 * inviluppo che ondula, uno tondo no.
 */
function rotondita(pts: THREE.Vector3[], frazioneAlta: number) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const soglia = minY + (maxY - minY) * frazioneAlta;
  const fascia = pts.filter((p) => p.y <= soglia);
  let cx = 0;
  let cz = 0;
  for (const p of fascia) {
    cx += p.x;
    cz += p.z;
  }
  cx /= fascia.length;
  cz /= fascia.length;

  const BIN = 180;
  const env = new Float64Array(BIN);
  for (const p of fascia) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const b =
      Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * BIN) % BIN;
    env[b] = Math.max(env[b], Math.hypot(dx, dz));
  }
  const pieni = Array.from(env).filter((r) => r > 0);
  const med = pieni.reduce((a, b) => a + b, 0) / pieni.length;
  const dev = Math.sqrt(
    pieni.reduce((s, r) => s + (r - med) ** 2, 0) / pieni.length,
  );
  return { spicchiCoperti: pieni.length, raggio: med, ondulazione: dev / med };
}

const originale = await carica(SRC);
const ottimizzato = await carica(DST);

// --- 1. struttura: i tre nodi su cui il codice fa presa
for (const nome of ["vetro", "tappo", "etichetta"]) {
  assert(
    ottimizzato.getObjectByName(nome),
    `manca il nodo "${nome}" nel GLB ottimizzato`,
  );
}

// --- 2. geometria complessiva invariata
const bOrig = new THREE.Box3().setFromObject(originale, true);
const bOtt = new THREE.Box3().setFromObject(ottimizzato, true);
const dOrig = bOrig.getSize(new THREE.Vector3());
const dOtt = bOtt.getSize(new THREE.Vector3());
const dim = (v: THREE.Vector3) =>
  v.toArray().map((n) => n.toFixed(4)).join(" × ");
console.log(`ingombro  originale   ${dim(dOrig)}`);
console.log(`ingombro  ottimizzato ${dim(dOtt)}`);
for (const asse of ["x", "y", "z"] as const) {
  const scarto = Math.abs(dOtt[asse] - dOrig[asse]) / dOrig[asse];
  assert(
    scarto < 0.01,
    `ingombro ${asse}: ${(scarto * 100).toFixed(2)}% di scarto, oltre l'1%`,
  );
}

// --- 3. il tappo è ancora tondo
const capOrig = rotondita(vertici(originale.getObjectByName("Cylinder_2")!), 0.25);
const capOtt = rotondita(vertici(ottimizzato.getObjectByName("tappo")!), 0.25);
const fmt = (r: ReturnType<typeof rotondita>) =>
  `raggio ${r.raggio.toFixed(4)}, ondulazione ${(r.ondulazione * 100).toFixed(2)}%, ${r.spicchiCoperti}/180 spicchi`;
console.log(`tappo     originale   ${fmt(capOrig)}`);
console.log(`tappo     ottimizzato ${fmt(capOtt)}`);
assert(
  capOtt.spicchiCoperti === 180,
  "il tappo ha spicchi vuoti: la silhouette è bucata",
);
assert(
  Math.abs(capOtt.raggio - capOrig.raggio) / capOrig.raggio < 0.01,
  "il raggio del tappo è cambiato di più dell'1%",
);
assert(
  capOtt.ondulazione < capOrig.ondulazione + 0.01,
  `la silhouette del tappo ondula ${(capOtt.ondulazione * 100).toFixed(2)}% contro ${(capOrig.ondulazione * 100).toFixed(2)}%: sta poligonando`,
);

// --- 4. i consumatori reggono: la sezione "Chi siamo" monta da qui
const { bottle, cap } = splitBottleGlb(ottimizzato);
const asm = buildBottleAssembly(bottle, cap);
console.log("assieme  ", JSON.stringify(asm.world));
const probe = new THREE.Group();
probe.add(asm.holder);
const ancorato = new THREE.Group();
ancorato.add(asm.capModel);
ancorato.applyMatrix4(asm.capAnchorLocal);
probe.add(ancorato);
probe.updateMatrixWorld(true);
const tot = new THREE.Box3().setFromObject(probe, true);
assert(Math.abs(tot.max.y - tot.min.y - 2) < 1e-3, "l'assieme non è più alto 2");
assert(
  Math.abs((tot.max.y + tot.min.y) / 2) < 1e-3,
  "l'assieme non è più centrato",
);
assert(asm.world.capSinkDepth > 0, "il tappo non entra più nel collo");
assert(
  asm.world.capRadius > asm.world.mouthRadius,
  "il tappo non copre più la bocca",
);

// --- 5. budget
const peso = fs.statSync(DST).size;
console.log(`peso      ${(peso / 1024).toFixed(0)} KB`);
assert(peso < 1.2 * 1024 * 1024, "oltre il budget di 1,2 MB");

console.log("OK");

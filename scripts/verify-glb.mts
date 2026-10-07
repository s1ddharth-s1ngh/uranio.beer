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
import { prepareBottle } from "../src/gl/prepareBottle.ts";
import { BANDS, BOTTLE, CAP, LABEL, NODES } from "../src/config/bottle.ts";

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

// --- 4b. la preparazione per l'esperienza (task 8.9): spazio oggetto unico,
// pivot al centro, etichetta fuori dal vetro, e la scena di partenza intatta
{
  const primaEtichetta = new THREE.Box3().setFromBufferAttribute(
    (ottimizzato.getObjectByName("etichetta") as THREE.Mesh).geometry.attributes
      .position as THREE.BufferAttribute,
  );

  const b = prepareBottle(ottimizzato);

  // trasformazioni azzerate: l'unica sopravvissuta è la scala dell'etichetta
  for (const nome of NODES) {
    const m = b.meshes[nome];
    assert(
      m.position.lengthSq() === 0 && m.rotation.x === 0 && m.rotation.y === 0 && m.rotation.z === 0,
      `la mesh "${nome}" ha ancora una trasformazione: gli shader leggerebbero spazi diversi`,
    );
  }
  assert.equal(b.meshes.vetro.scale.x, 1);
  assert.equal(b.meshes.tappo.scale.x, 1, "la scala non uniforme del tappo non è stata bakata");
  assert.equal(b.meshes.etichetta.scale.x, LABEL.scaleXZ);

  // le tre geometrie vivono nello stesso spazio, e quello spazio è quello su
  // cui sono tarate le costanti di config/bottle.ts
  const scatola = (nome: string) =>
    new THREE.Box3().setFromBufferAttribute(
      b.meshes[nome as keyof typeof b.meshes].geometry.attributes
        .position as THREE.BufferAttribute,
    );
  const vetro = scatola("vetro");
  const tappo = scatola("tappo");
  const etichetta = scatola("etichetta");
  console.log(
    `spazio oggetto  vetro ${vetro.min.y.toFixed(4)}→${vetro.max.y.toFixed(4)}  ` +
      `tappo ${tappo.min.y.toFixed(4)}→${tappo.max.y.toFixed(4)}  ` +
      `etichetta ${etichetta.min.y.toFixed(4)}→${etichetta.max.y.toFixed(4)}`,
  );
  const vicino = (a: number, b: number, tol: number, cosa: string) =>
    assert(Math.abs(a - b) < tol, `${cosa}: ${a.toFixed(4)} invece di ${b}`);
  vicino(tappo.min.y, CAP.minY, 0.01, "base del tappo");
  vicino(tappo.max.y, CAP.maxY, 0.01, "cima del tappo");
  vicino(etichetta.min.y, LABEL.minY, 0.01, "bordo basso dell'etichetta");
  vicino(etichetta.max.y, LABEL.maxY, 0.01, "bordo alto dell'etichetta");
  vicino(vetro.max.y - vetro.min.y, BOTTLE.height - (BOTTLE.maxY - CAP.maxY), 0.05, "altezza del vetro");

  // le quattro fasce cadono dentro l'etichetta, con tutta la loro mezza altezza
  for (const [nome, fascia] of Object.entries(BANDS)) {
    assert(
      fascia.y - fascia.half >= etichetta.min.y - 1e-3 &&
        fascia.y + fascia.half <= etichetta.max.y + 1e-3,
      `la fascia ${nome} (${(fascia.y - fascia.half).toFixed(3)}–${(fascia.y + fascia.half).toFixed(3)}) esce dall'etichetta`,
    );
  }

  // pivot: il centro geometrico è nell'origine, quindi ruotare non sposta
  b.pivot.rotation.set(0, Math.PI, 0);
  b.pivot.updateMatrixWorld(true);
  const ruotata = new THREE.Box3().setFromObject(b.pivot, true);
  b.pivot.rotation.set(0, 0, 0);
  b.pivot.updateMatrixWorld(true);
  const ferma = new THREE.Box3().setFromObject(b.pivot, true);
  assert(
    Math.abs(ferma.getCenter(new THREE.Vector3()).y) < 1e-3,
    "la bottiglia non è centrata sul pivot: ogni rotazione la farebbe scendere",
  );
  // Ruotando di π l'**altezza** non deve muoversi: è questo che il pivot al
  // centro garantisce (spec 3.2). In orizzontale un filo si sposta e va bene:
  // l'asse del vetro non è esattamente a x = 0 (0,003) e l'etichetta avvolge
  // 270° in modo asimmetrico, quindi il bbox cambia girando. È la bottiglia a
  // non essere perfettamente simmetrica, non il pivot a essere sbagliato.
  const derivaY = Math.abs(
    ruotata.getCenter(new THREE.Vector3()).y - ferma.getCenter(new THREE.Vector3()).y,
  );
  const derivaXZ = Math.hypot(
    ruotata.getCenter(new THREE.Vector3()).x - ferma.getCenter(new THREE.Vector3()).x,
    ruotata.getCenter(new THREE.Vector3()).z - ferma.getCenter(new THREE.Vector3()).z,
  );
  console.log(
    `rotazione di π   deriva y ${derivaY.toFixed(5)}  orizzontale ${derivaXZ.toFixed(4)} (asimmetria del modello)`,
  );
  assert(derivaY < 1e-3, "ruotando di π la bottiglia sale o scende: il pivot non è al centro");
  assert(derivaXZ < 0.05, `ruotando di π la bottiglia scarta di ${derivaXZ.toFixed(3)} in orizzontale: troppo`);

  // l'etichetta esce dal vetro: è la condizione per non avere z-fighting
  const raggio = (box: THREE.Box3, scala: number) =>
    Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z) * scala;
  const rEtichetta = raggio(etichetta, LABEL.scaleXZ);
  // Il raggio del vetro va misurato **alla stessa altezza dell'etichetta**,
  // non sul bbox intero: il collo è più stretto e darebbe un confronto falso.
  // La fascia va allargata un po' perché il corpo è un tubo diritto e i suoi
  // vertici stanno solo agli anelli che lo chiudono — appena sotto 0,455 e
  // appena sopra 1,733 — mentre in mezzo ci sono solo triangoli lunghi.
  const pos = b.meshes.vetro.geometry.attributes.position as THREE.BufferAttribute;
  const MARGINE = 0.15;
  let rVetro = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < etichetta.min.y - MARGINE || y > etichetta.max.y + MARGINE) continue;
    rVetro = Math.max(rVetro, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  assert(rVetro > 0, "nessun vertice di vetro all'altezza dell'etichetta: controlla la fascia");
  console.log(
    `etichetta r ${rEtichetta.toFixed(4)} contro vetro r ${rVetro.toFixed(4)} nella stessa fascia`,
  );
  assert(
    rEtichetta > rVetro,
    "l'etichetta sta ancora dentro il vetro: z-fighting o etichetta invisibile",
  );
  assert(
    rEtichetta - rVetro < 0.02,
    "l'etichetta è troppo staccata dal vetro: si vedrebbe fluttuare",
  );

  // e la scena di partenza non è stata toccata: la sezione "Chi siamo" carica
  // lo stesso GLB dalla stessa cache (regola 10.1.10)
  const dopoEtichetta = new THREE.Box3().setFromBufferAttribute(
    (ottimizzato.getObjectByName("etichetta") as THREE.Mesh).geometry.attributes
      .position as THREE.BufferAttribute,
  );
  assert(
    primaEtichetta.min.distanceTo(dopoEtichetta.min) < 1e-9 &&
      primaEtichetta.max.distanceTo(dopoEtichetta.max) < 1e-9,
    "prepareBottle ha modificato la geometria originale: la sezione About si troverebbe la bottiglia deformata",
  );

  b.dispose();
}

// --- 5. budget
const peso = fs.statSync(DST).size;
console.log(`peso      ${(peso / 1024).toFixed(0)} KB`);
assert(peso < 1.2 * 1024 * 1024, "oltre il budget di 1,2 MB");

console.log("OK");

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
import { cloneBottle, prepareBottle } from "../src/gl/prepareBottle.ts";
import { LIQUID } from "../src/config/materials.ts";
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

// --- 4. la preparazione per l'esperienza (task 8.9): spazio oggetto unico,
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

// --- 4c. la birra dentro (task 8.26): c'è solo se il vetro la lascia
// vedere; quando c'è, sta nella cavità del vetro a ogni altezza, arriva al
// livello giusto, non esce dal fondo; su GPU deboli non c'è; i cloni del
// carosello la condividono per intero
birra: {
  const b = prepareBottle(ottimizzato);
  const birra = b.liquid;
  const vetroMat = b.meshes.vetro.material as THREE.MeshPhysicalMaterial;
  if (!LIQUID.enabled || vetroMat.transmission === 0) {
    // oggi è così (`GLASS.transmission` a 0, config/materials.ts): una birra
    // dietro un vetro opaco sarebbe una draw call che non si vede
    assert.equal(birra, null, "il vetro non trasmette: la birra non deve essere creata");
    assert.equal(cloneBottle(b).liquid, null);
    console.log("birra  spenta: il vetro non trasmette");
    b.dispose();
    break birra;
  }
  assert(birra, "con LIQUID.enabled e un vetro che trasmette la birra deve esserci");
  assert.equal(birra.parent, b.inner, "la birra deve stare in inner: segue il pivot");

  // Il vetro è disegnato davanti alla birra solo se non è `transparent`: è la
  // trasmissione che la fa vedere filtrata e spenta dalle maschere
  assert(!vetroMat.transparent, "il vetro è transparent: la birra finirebbe sopra, non dietro");

  // Il controllo non riusa la misura di prepareBottle: spara raggi veri contro
  // vetro e birra, dall'asse verso fuori e dall'alto verso il fondo
  const lato = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const sondaVetro = new THREE.Mesh(b.meshes.vetro.geometry, lato);
  const sondaBirra = new THREE.Mesh(birra.geometry, lato);
  const rc = new THREE.Raycaster();
  const primo = (sonda: THREE.Mesh, da: THREE.Vector3, dir: THREE.Vector3) => {
    rc.set(da, dir);
    const h: THREE.Intersection[] = [];
    sonda.raycast(rc, h);
    return h.length ? Math.min(...h.map((x) => x.distance)) : Infinity;
  };

  const scatolaBirra = new THREE.Box3().setFromBufferAttribute(
    birra.geometry.attributes.position as THREE.BufferAttribute,
  );
  const scatolaVetro = new THREE.Box3().setFromBufferAttribute(
    b.meshes.vetro.geometry.attributes.position as THREE.BufferAttribute,
  );

  // pareti: dall'asse in fuori, sopra la cupola del fondo
  let minParete = Infinity;
  for (let y = 0.09; y <= LIQUID.fillY - 0.005; y += 0.02) {
    for (let k = 0; k < 6; k++) {
      const a = 0.3 + (k * Math.PI) / 3;
      const da = new THREE.Vector3(0, y, 0);
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const rB = primo(sondaBirra, da, dir);
      const rV = primo(sondaVetro, da, dir);
      assert(rB < Infinity && rV < Infinity, `a y ${y.toFixed(2)} un raggio non trova birra o vetro`);
      minParete = Math.min(minParete, rV - rB);
    }
  }
  // fondo: dall'alto in giù, dall'asse fino quasi alla parete
  let minFondo = Infinity;
  for (let r = 0; r <= 0.57; r += 0.01) {
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const da = new THREE.Vector3(r * Math.cos(a), LABEL.minY, r * Math.sin(a));
      const dir = new THREE.Vector3(0, -1, 0);
      minFondo = Math.min(minFondo, primo(sondaVetro, da, dir) - primo(sondaBirra, da, dir));
    }
  }
  console.log(
    `birra  ${scatolaBirra.min.y.toFixed(4)}→${scatolaBirra.max.y.toFixed(4)}  ` +
      `dalla parete ≥ ${minParete.toFixed(4)}  dal fondo ≥ ${minFondo.toFixed(4)}`,
  );
  assert(minParete > 0.002, `la birra tocca o fora la parete del vetro (${minParete.toFixed(4)})`);
  assert(minFondo > 0.002, `la birra tocca o fora il fondo del vetro (${minFondo.toFixed(4)})`);
  assert(Math.abs(scatolaBirra.max.y - LIQUID.fillY) < 0.01, `la birra arriva a ${scatolaBirra.max.y.toFixed(4)} invece di ${LIQUID.fillY}`);
  assert(scatolaBirra.min.y > scatolaVetro.min.y, "la birra esce dal fondo della bottiglia");

  // i cloni: stessa geometria e stesso materiale, una sola copia sulla GPU
  const copia = cloneBottle(b);
  assert(copia.liquid, "il clone ha perso la birra");
  assert.equal(copia.liquid.geometry, birra.geometry, "il clone ha una geometria della birra sua");
  assert.equal(copia.liquid.material, birra.material, "il clone ha un materiale della birra suo");
  assert.equal(copia.liquid.parent, copia.inner);

  // su GPU deboli la trasmissione è 0: la birra non si vedrebbe, quindi non c'è
  const debole = prepareBottle(ottimizzato, { lowEnd: true });
  assert.equal(debole.liquid, null, "con lowEnd la birra non deve essere creata");
  assert(!debole.inner.getObjectByName("birra"), "con lowEnd c'è una birra nella scena");
  assert.equal(cloneBottle(debole).liquid, null);

  lato.dispose();
  copia.dispose();
  debole.dispose();
  b.dispose();
}

// --- 4d. una sola texture dell'etichetta (task 8.27): `Bottle.tsx` e
// `Carousel.tsx` preparano ognuno la sua copia, e i cloni del carosello
// clonano i materiali. Tutti devono puntare alla texture del GLB, non a copie:
// sono 8,8 MB di GPU ciascuna, con le mipmap
{
  const etichetta = (b: { meshes: { etichetta: THREE.Mesh } }) =>
    (b.meshes.etichetta.material as THREE.MeshStandardMaterial).map;
  const a = prepareBottle(ottimizzato);
  const c = prepareBottle(ottimizzato);
  const copia = cloneBottle(c);
  const mappa = etichetta(a);
  assert(mappa, "l'etichetta preparata non ha la texture");
  assert.equal(etichetta(c), mappa, "due preparazioni, due texture dell'etichetta");
  assert.equal(etichetta(copia), mappa, "il clone ha una texture dell'etichetta sua");
  let texture = 0;
  for (const m of [...Object.values(a.meshes), ...Object.values(copia.meshes)]) {
    if ((m.material as THREE.MeshStandardMaterial).map) texture++;
  }
  assert.equal(texture, 2, "solo l'etichetta deve avere una texture");
  copia.dispose();
  c.dispose();
  a.dispose();
}

// --- 5. budget
const peso = fs.statSync(DST).size;
console.log(`peso      ${(peso / 1024).toFixed(0)} KB`);
assert(peso < 1.2 * 1024 * 1024, "oltre il budget di 1,2 MB");

console.log("OK");

// La preparazione del modello (spec 6.2), in three puro.
//
// Due cose non negoziabili, e sono il motivo per cui questa funzione esiste
// invece di montare il GLB così com'è:
//
// 1. **Un solo spazio oggetto per le tre mesh.** Tutte le misure di
//    `config/bottle.ts` sono altezze nello spazio del modello: se
//    vetro, tappo ed etichetta hanno trasformazioni diverse — e il tappo ne ha
//    una con scala non uniforme (≈ 0,56 / 0,067 / 0,56) — la stessa altezza
//    significa tre cose diverse, e misure, ancore e volo del tappo
//    (`config/bottle.ts`) non tornano più. Quindi si fa il bake della matrice
//    mondo nella geometria e si azzera la trasformazione.
// 2. **Non si tocca la scena di partenza.** `useGLTF` tiene una cache e la
//    stessa scena la prepara due volte (la protagonista e la base della
//    gamma, `gl/Carousel.tsx`): se si bakasse la geometria originale, la
//    seconda preparazione bakerebbe una geometria già bakata. Qui si clona
//    tutto quello che si modifica.

import * as THREE from "three";
import {
  BOTTLE,
  CAP,
  degFromU,
  LABEL,
  LABEL_U_TO_DEG,
  NODES,
  yFromV,
  type NodeName,
} from "../config/bottle.ts";
import {
  CAP_MATERIAL,
  GLASS,
  GLASS_LOW_END,
  LABEL_MATERIAL,
  LABEL_RENDER_ORDER,
  LIQUID,
} from "../config/materials.ts";
import {
  createBottleUniforms,
  patchBottleMaterial,
  type BottleUniforms,
} from "./materials/patchBottle.ts";

export interface PrepareOptions {
  /** GPU debole: via la `transmission`, che costa un passaggio in più */
  lowEnd?: boolean;
  /**
   * Bottiglia vista da lontano (le copie dell'anello e della fila): tappo ed
   * etichetta leggeri invece di quelli del modello (`geometriaLeggera`)
   */
  lowPoly?: boolean;
  /** `renderer.capabilities.getMaxAnisotropy()`; 1 = nessuna anisotropia */
  maxAnisotropy?: number;
}

export interface PreparedBottle {
  /** da aggiungere alla scena: si posiziona e si ruota questo */
  pivot: THREE.Group;
  /** dentro il pivot, spostato di −centerY: non si tocca */
  inner: THREE.Group;
  meshes: Record<NodeName, THREE.Mesh>;
  /** la birra dentro (spec 6.10); `null` su GPU deboli o se spenta da config */
  liquid: THREE.Mesh | null;
  /** la luce della bottiglia (`materials/patchBottle.ts`): penombra e faccia */
  uniforms: BottleUniforms;
  dispose(): void;
}

function meshByName(source: THREE.Object3D, name: string): THREE.Mesh {
  const found = source.getObjectByName(name);
  if (!found || !(found as THREE.Mesh).isMesh) {
    throw new Error(
      `prepareBottle: nel GLB manca la mesh "${name}". I nomi li assegna ` +
        `scripts/optimize-glb.mjs: rigenera il modello con "npm run optimize:glb".`,
    );
  }
  return found as THREE.Mesh;
}

/** gli attributi che servono alla scena: il resto del GLB non lo usa nessuno */
const ATTRIBUTI = ["position", "normal", "uv"] as const;

/**
 * Da attributo quantizzato a `Float32`.
 *
 * Il GLB è compresso meshopt **e** quantizzato (`KHR_mesh_quantization`): le
 * posizioni arrivano come `Int16` normalizzati e interlacciati, con la scala
 * vera nel nodo (il vetro ha geometria in ±1 e scala 2,068). Scriverci dentro
 * delle coordinate in float — che è quello che fa `applyMatrix4` — significa
 * troncarle a interi e distruggere la mesh: il bake sembra funzionare e la
 * bottiglia esce alta 1,92 invece di 4,18.
 *
 * `getComponent` denormalizza e sa leggere anche gli interlacciati, quindi è
 * la via più corta per uscirne.
 */
function dequantizza(
  attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.BufferAttribute {
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) {
    for (let c = 0; c < attr.itemSize; c++) {
      out[i * attr.itemSize + c] = attr.getComponent(i, c);
    }
  }
  return new THREE.BufferAttribute(out, attr.itemSize);
}

/** Geometria nuova, in `Float32`, portata in spazio mondo. */
function bake(mesh: THREE.Mesh): THREE.BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const nome of ATTRIBUTI) {
    const a = src.attributes[nome];
    if (a) g.setAttribute(nome, dequantizza(a));
  }
  // Le normali le trasforma `applyMatrix4` con la matrice normale, che per la
  // scala non uniforme del tappo è la cosa giusta; restano non unitarie, ma
  // three le normalizza nel vertex shader. Ricalcolarle con
  // `computeVertexNormals` sarebbe peggio: butterebbe via le normali lisce che
  // il task 8.4 ha costruito a mano per la zigrinatura della corona.
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Il profilo della birra, misurato sulla **cavità** del vetro vero e staccato
 * di `LIQUID.gap`: così sta dentro per costruzione anche dove la 3.2
 * approssima (spalla, collo, fondo).
 *
 * Il vetro ha due pareti, quindi "il raggio massimo per fascia" sarebbe la
 * parete esterna e la birra forerebbe quella interna. Si prende invece la
 * parete più vicina all'asse:
 *
 * - **pareti:** ogni spigolo dei triangoli, portato nel piano (r, y), taglia
 *   l'altezza y a un certo raggio; il minimo fra tutti è la parete interna, su
 *   tutti gli angoli insieme (l'asse del vetro non è esattamente a x = 0).
 *   Basta campionare ai livelli dei vertici: fra due anelli la parete è dritta.
 * - **fondo:** qui gli spigoli non bastano, il cerchio in cima alla cupola del
 *   fondo è chiuso da corde che attraversano l'asse senza toccarlo. Pochi
 *   raggi verso il basso, dall'asse al tallone.
 */
function profiloBirra(vetro: THREE.BufferGeometry): THREE.Vector2[] {
  const { fillY, gap, floorStep } = LIQUID;
  const pos = vetro.attributes.position;
  const idx = vetro.index;
  const n = idx ? idx.count : pos.count;
  const r = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) r[i] = Math.hypot(pos.getX(i), pos.getZ(i));

  // spigoli nel piano (r, y), quattro numeri l'uno; i doppi non fanno danno
  const lati: number[] = [];
  const vert = (k: number) => (idx ? idx.getX(k) : k);
  for (let t = 0; t + 2 < n; t += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const i = vert(t + a);
      const j = vert(t + b);
      lati.push(r[i], pos.getY(i), r[j], pos.getY(j));
    }
  }
  const parete = (y: number) => {
    let min = Infinity;
    for (let k = 0; k < lati.length; k += 4) {
      const r1 = lati[k];
      const y1 = lati[k + 1];
      const r2 = lati[k + 2];
      const y2 = lati[k + 3];
      if (y1 === y2 || y < Math.min(y1, y2) || y > Math.max(y1, y2)) continue;
      min = Math.min(min, r1 + ((r2 - r1) * (y - y1)) / (y2 - y1));
    }
    return min;
  };

  // il fondo: il primo vetro che si incontra scendendo da dentro il corpo
  const sonda = new THREE.Mesh(
    vetro,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  const rc = new THREE.Raycaster();
  const giu = new THREE.Vector3(0, -1, 0);
  const da = new THREE.Vector3();
  const colpi: THREE.Intersection[] = [];
  const fondo = (raggio: number) => {
    rc.set(da.set(raggio, LABEL.minY, 0), giu);
    colpi.length = 0;
    sonda.raycast(rc, colpi);
    if (!colpi.length) {
      throw new Error(
        `prepareBottle: nessun fondo sotto r = ${raggio.toFixed(3)}. Il vetro è ` +
          `cambiato: il profilo della birra (spec 6.10) va rimisurato.`,
      );
    }
    return colpi.reduce((max, c) => Math.max(max, c.point.y), -Infinity);
  };

  // Le pareti partono appena sopra la cupola del fondo: più in basso l'asse
  // stesso è dentro il vetro e "la parete più vicina all'asse" non vuol dire
  // più niente. Sotto quella quota comanda il fondo.
  const pareteDa = fondo(0) + 2 * gap;
  const punti: THREE.Vector2[] = [];
  const rFondo = parete(pareteDa) - gap;
  for (let x = 0; x < rFondo; x += floorStep) {
    const y = fondo(x) + gap;
    if (y >= pareteDa) break;
    punti.push(new THREE.Vector2(x, y));
  }
  (sonda.material as THREE.Material).dispose();

  // al millesimo: gli anelli sono una sessantina, i vertici migliaia
  const livelli = new Set<number>([pareteDa, fillY]);
  for (let i = 0; i < pos.count; i++) {
    const y = Math.round(pos.getY(i) * 1000) / 1000;
    if (y > pareteDa && y < fillY) livelli.add(y);
  }
  for (const y of [...livelli].sort((a, b) => a - b)) {
    punti.push(new THREE.Vector2(parete(y) - gap, y));
  }
  // il tappo della birra: la superficie piatta a `fillY`
  punti.push(new THREE.Vector2(0, fillY));
  return punti;
}

/**
 * Toglie la parete interna del vetro: i triangoli che guardano verso l'asse.
 *
 * Il vetro ha due pareti, e con la trasmissione a 0 quella interna non si vede
 * mai: il vetro è opaco e scuro. Ma si disegna lo stesso, e nella fila del
 * finale, con nove bottiglie grandi, valeva 2,5–4 ms a frame su una GPU
 * integrata a 1920×1080 (misurato il 2026-11-17): rasterizzazione e test di
 * profondità di quasi metà dei triangoli del vetro, dietro alla parete fuori.
 * Il fondo e il labbro (normali verticali) restano. Serve solo senza birra:
 * il profilo della birra si misura proprio sulla parete interna.
 */
function senzaParetiInterne(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const idx = g.index;
  if (!idx) return;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const m = new THREE.Vector3();
  const fuori: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(p, idx.getX(t));
    b.fromBufferAttribute(p, idx.getX(t + 1));
    c.fromBufferAttribute(p, idx.getX(t + 2));
    n.subVectors(c, b).cross(m.subVectors(a, b)).normalize();
    m.copy(a).add(b).add(c).divideScalar(3);
    // la normale contro la direzione radiale: sotto −0,2 guarda l'asse
    const radiale = (n.x * m.x + n.z * m.z) / (Math.hypot(m.x, m.z) || 1);
    if (radiale < -0.2) continue;
    fuori.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }
  g.setIndex(fuori);
}

/** spicchi del tappo e di ciascuna striscia dell'etichetta leggeri */
const SPICCHI = 32;

/**
 * Tappo ed etichetta per le bottiglie viste da lontano, costruiti invece che
 * presi dal modello.
 *
 * Nel GLB il tappo ha 19.836 triangoli (la corona, 180 spicchi) e
 * l'etichetta 16.384: nell'anello e nella fila il tappo è largo una trentina
 * di pixel, cioè decine di triangoli per pixel, e la GPU colora comunque un
 * quadrato di 2 × 2 pixel per ognuno; con l'antialias del contesto anche di
 * più. Nove bottiglie così erano il frame più caro di tutta l'esperienza
 * (misurato il 2026-11-17). Da lontano un cilindro a 32 spicchi e due
 * strisce cilindriche con la stessa mappatura (`LABEL_U_TO_DEG`,
 * `yFromV`, misurate sul modello) non si distinguono: ~9 mila triangoli a
 * copia invece di ~45 mila. Il vetro resta quello vero: è la sagoma.
 */
function geometriaLeggera(nome: Exclude<NodeName, "vetro">): THREE.BufferGeometry {
  if (nome === "tappo") {
    // un tronco di cono con la gonna a denti, ventuno come la corona vera e
    // due spicchi per dente: un cilindro liscio nella fila del finale si
    // leggeva come un cappello a cilindro accanto al tappo vero
    const DENTI = 21;
    const altezza = CAP.maxY - CAP.minY;
    const g = new THREE.CylinderGeometry(CAP.radius * 0.92, CAP.radius, altezza, DENTI * 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      if (p.getY(i) > -altezza / 2 + 1e-6 || Math.hypot(x, z) < 1e-6) continue;
      // sull'anello in basso `cos(21θ)` vale ±1 a vertici alterni: denti
      const k = 1 + 0.06 * Math.cos(DENTI * Math.atan2(x, z));
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    g.translate(0, CAP.centerY, 0);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  // l'etichetta: due strisce, il fronte e il retro, che nella texture si
  // toccano alla cucitura e sul vetro lasciano in mezzo lo spicchio nudo, come
  // nel modello. Un solo anello di quadrilateri in altezza: lì il corpo è un
  // cilindro dritto
  const { seamU } = LABEL_U_TO_DEG;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const [u0, u1] of [[0, seamU], [seamU, 1]]) {
    const primo = pos.length / 3;
    for (let i = 0; i <= SPICCHI; i++) {
      const u = u0 + ((u1 - u0) * i) / SPICCHI;
      const a = (degFromU(u) * Math.PI) / 180;
      // 0° guarda la camera di default (+z), positivo verso +x
      const x = Math.sin(a);
      const z = Math.cos(a);
      for (const v of [0, 1]) {
        pos.push(x * LABEL.radius, yFromV(v), z * LABEL.radius);
        nor.push(x, 0, z);
        uv.push(u, v);
      }
    }
    // sopra e sotto dello spicchio i, poi dell'i+1: antiorari visti da fuori
    for (let i = 0; i < SPICCHI; i++) {
      const k = primo + i * 2;
      idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function prepareBottle(
  source: THREE.Object3D,
  { lowEnd = false, lowPoly = false, maxAnisotropy = 1 }: PrepareOptions = {},
): PreparedBottle {
  source.updateMatrixWorld(true);

  const geometrie = {} as Record<NodeName, THREE.BufferGeometry>;
  for (const nome of NODES) {
    geometrie[nome] =
      lowPoly && nome !== "vetro" ? geometriaLeggera(nome) : bake(meshByName(source, nome));
  }

  // Controllo di coerenza: tutte le costanti di `config/bottle.ts` e con esse
  // ancore, volo del tappo e keyframe dipendono dall'altezza del modello. Se
  // l'ottimizzazione la cambia è meglio fermarsi che disegnare in silenzio una
  // scena in cui il tappo si stacca a mezz'aria e le ancore sbagliano.
  const box = new THREE.Box3();
  for (const g of Object.values(geometrie)) box.union(g.boundingBox!);
  const altezza = box.max.y - box.min.y;
  if (Math.abs(altezza - BOTTLE.height) / BOTTLE.height > 0.01) {
    throw new Error(
      `prepareBottle: il modello è alto ${altezza.toFixed(4)} invece di ` +
        `${BOTTLE.height}. Aggiorna BOTTLE in src/config/bottle.ts (e con esso ` +
        `fasce e ancore) oppure rigenera il GLB.`,
    );
  }

  const materiali = {
    vetro: new THREE.MeshPhysicalMaterial({
      ...GLASS,
      ...(lowEnd ? GLASS_LOW_END : null),
      color: new THREE.Color(GLASS.color),
      attenuationColor: new THREE.Color(GLASS.attenuationColor),
    }),
    tappo: new THREE.MeshPhysicalMaterial({
      ...CAP_MATERIAL,
      color: new THREE.Color(CAP_MATERIAL.color),
    }),
    etichetta: new THREE.MeshStandardMaterial({
      ...LABEL_MATERIAL,
      // l'etichetta è un piano appoggiato sul vetro: senza offset i due
      // affiorano l'uno dentro l'altro a seconda della distanza (z-fighting)
      polygonOffset: true,
      polygonOffsetFactor: LABEL.polygonOffsetFactor,
      polygonOffsetUnits: LABEL.polygonOffsetUnits,
    }),
  };

  // La texture resta quella del GLB, condivisa: clonarla raddoppierebbe la
  // memoria GPU per niente. Anisotropia e color space si impostano sulla
  // texture condivisa perché sono corretti per chiunque la usi, About inclusa.
  const mappa = (
    meshByName(source, "etichetta").material as THREE.MeshStandardMaterial
  ).map;
  if (mappa) {
    mappa.anisotropy = maxAnisotropy;
    mappa.colorSpace = THREE.SRGBColorSpace;
    mappa.generateMipmaps = true;
    mappa.needsUpdate = true;
    materiali.etichetta.map = mappa;
  }

  // La penombra e la luce sulla faccia si innestano nei materiali standard
  // invece di sostituirli: il vetro fisico e il metallo devono continuare a
  // illuminarsi come li illumina three, la patch decide solo quanta di quella
  // luce resta. Il tappo condivide gli uniform: la faccia è solo
  // dell'etichetta, e staccato si accende e si spegne con la bottiglia
  const uniforms = createBottleUniforms();
  patchBottleMaterial(materiali.vetro, uniforms);
  patchBottleMaterial(materiali.tappo, uniforms);
  patchBottleMaterial(materiali.etichetta, uniforms, true);

  const inner = new THREE.Group();
  inner.name = "bottiglia-inner";
  const meshes = {} as Record<NodeName, THREE.Mesh>;
  for (const nome of NODES) {
    const m = new THREE.Mesh(geometrie[nome], materiali[nome]);
    m.name = nome;
    meshes[nome] = m;
    inner.add(m);
  }

  // L'etichetta esce dal vetro dell'1,2%: nel GLB il suo raggio (0,651) è
  // **sotto** quello del vetro (0,656), quindi senza questo sta dentro e non
  // si vede. La scala sta sulla mesh e non nella geometria di proposito: così
  // l'attributo `position` resta nello stesso spazio delle altre due mesh e
  // gli shader continuano a leggere la stessa altezza.
  meshes.etichetta.scale.set(LABEL.scaleXZ, 1, LABEL.scaleXZ);
  meshes.etichetta.renderOrder = LABEL_RENDER_ORDER;

  // La birra si vede solo attraverso la `transmission` del vetro: il vetro non
  // è `transparent`, la copre del tutto e la restituisce dal render target
  // della trasmissione, filtrata e già moltiplicata dalle maschere. Senza
  // trasmissione (su GPU deboli, o con `GLASS.transmission` a 0) sarebbe
  // invisibile: non si crea, ed è una draw call in meno per bottiglia. Niente
  // maschere qui, quindi geometria e materiale si possono condividere con i
  // cloni.
  let liquid: THREE.Mesh | null = null;
  if (LIQUID.enabled && materiali.vetro.transmission > 0) {
    liquid = new THREE.Mesh(
      new THREE.LatheGeometry(profiloBirra(geometrie.vetro), LIQUID.segments),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(LIQUID.color),
        emissive: new THREE.Color(LIQUID.emissive),
        emissiveIntensity: LIQUID.emissiveIntensity,
        roughness: LIQUID.roughness,
        metalness: LIQUID.metalness,
      }),
    );
    liquid.name = "birra";
    inner.add(liquid);
  }

  if (!liquid) senzaParetiInterne(geometrie.vetro);

  // Il centro geometrico va nell'origine del pivot: così ogni rotazione gira
  // attorno alla pancia della bottiglia e non attorno al suo fondo.
  inner.position.y = -BOTTLE.centerY;

  const pivot = new THREE.Group();
  pivot.name = "bottiglia";
  pivot.add(inner);

  return {
    pivot,
    inner,
    meshes,
    liquid,
    uniforms,
    dispose() {
      for (const g of Object.values(geometrie)) g.dispose();
      for (const m of Object.values(materiali)) m.dispose();
      liquid?.geometry.dispose();
      (liquid?.material as THREE.Material | undefined)?.dispose();
    },
  };
}

/**
 * Una copia per il carosello: **geometrie condivise**, materiali e uniform
 * propri.
 *
 * Le geometrie sono 24 mila vertici e la texture 133 KB: duplicarle otto volte
 * sarebbe tutta memoria GPU buttata, perché le bottiglie sono identiche. I
 * materiali invece devono essere distinti, perché ognuno ha la sua luce: le
 * laterali dell'anello in penombra, quelle della fila quasi piene.
 *
 * `clone()` di un materiale si porta dietro anche `onBeforeCompile`, e con
 * essa la chiusura sugli uniform **dell'originale**: senza ri-innestare la
 * patch, tutte le copie piloterebbero la stessa luce.
 */
export function cloneBottle(src: PreparedBottle): PreparedBottle {
  const uniforms = createBottleUniforms();
  const materiali: THREE.Material[] = [];
  const meshes = {} as Record<NodeName, THREE.Mesh>;

  const inner = new THREE.Group();
  inner.name = "bottiglia-inner";
  for (const nome of NODES) {
    const sorgente = src.meshes[nome];
    const mat = (sorgente.material as THREE.Material).clone();
    patchBottleMaterial(mat, uniforms, nome === "etichetta");
    const m = new THREE.Mesh(sorgente.geometry, mat);
    m.name = nome;
    m.scale.copy(sorgente.scale);
    m.renderOrder = sorgente.renderOrder;
    materiali.push(mat);
    meshes[nome] = m;
    inner.add(m);
  }
  let liquid: THREE.Mesh | null = null;
  if (src.liquid) {
    liquid = new THREE.Mesh(src.liquid.geometry, src.liquid.material);
    liquid.name = src.liquid.name;
    inner.add(liquid);
  }
  inner.position.copy(src.inner.position);

  const pivot = new THREE.Group();
  pivot.name = "bottiglia-copia";
  pivot.add(inner);

  return {
    pivot,
    inner,
    meshes,
    liquid,
    uniforms,
    dispose() {
      // le geometrie no, e la birra nemmeno: sono dell'originale, che le
      // libera lui
      for (const m of materiali) m.dispose();
    },
  };
}

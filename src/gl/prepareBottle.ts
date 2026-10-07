// La preparazione del modello (spec 6.2), in three puro.
//
// Due cose non negoziabili, e sono il motivo per cui questa funzione esiste
// invece di montare il GLB così com'è:
//
// 1. **Un solo spazio oggetto per le tre mesh.** Gli shader `reveal` e `focus`
//    (task 8.10) decidono cosa è acceso leggendo `position.y` del vertice: se
//    vetro, tappo ed etichetta hanno trasformazioni diverse — e il tappo ne ha
//    una con scala non uniforme (≈ 0,56 / 0,067 / 0,56) — la stessa altezza
//    significa tre cose diverse e la fascia accesa si spezza. Quindi si fa il
//    bake della matrice mondo nella geometria e si azzera la trasformazione.
// 2. **Non si tocca la scena di partenza.** Lo stesso GLB lo carica anche la
//    sezione "Chi siamo" (regola 10.1.10) e `useGLTF` tiene una cache: se si
//    bakasse la geometria originale, la sezione About si troverebbe la
//    bottiglia deformata. Qui si clona tutto quello che si modifica.

import * as THREE from "three";
import { BOTTLE, LABEL, NODES, type NodeName } from "../config/bottle.ts";
import {
  CAP_MATERIAL,
  GLASS,
  GLASS_LOW_END,
  LABEL_MATERIAL,
  LABEL_RENDER_ORDER,
} from "../config/materials.ts";

export interface PrepareOptions {
  /** GPU debole: via la `transmission`, che costa un passaggio in più */
  lowEnd?: boolean;
  /** `renderer.capabilities.getMaxAnisotropy()`; 1 = nessuna anisotropia */
  maxAnisotropy?: number;
}

export interface PreparedBottle {
  /** da aggiungere alla scena: si posiziona e si ruota questo */
  pivot: THREE.Group;
  /** dentro il pivot, spostato di −centerY: non si tocca */
  inner: THREE.Group;
  meshes: Record<NodeName, THREE.Mesh>;
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

export function prepareBottle(
  source: THREE.Object3D,
  { lowEnd = false, maxAnisotropy = 1 }: PrepareOptions = {},
): PreparedBottle {
  source.updateMatrixWorld(true);

  const geometrie = {} as Record<NodeName, THREE.BufferGeometry>;
  for (const nome of NODES) geometrie[nome] = bake(meshByName(source, nome));

  // Controllo di coerenza: tutte le costanti di `config/bottle.ts` e con esse
  // fasce, ancore e keyframe dipendono dall'altezza del modello. Se
  // l'ottimizzazione la cambia è meglio fermarsi che disegnare in silenzio una
  // scena in cui la fascia accesa non cade sul paragrafo giusto.
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
    dispose() {
      for (const g of Object.values(geometrie)) g.dispose();
      for (const m of Object.values(materiali)) m.dispose();
    },
  };
}

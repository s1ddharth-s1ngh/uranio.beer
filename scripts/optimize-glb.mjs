// Prepara il GLB della bottiglia per il web: da 5,8 MB a qualcosa che si
// scarica su una connessione vera.
//
//   npm run optimize:glb
//   assets-src/Crisi_Economica_etichettata.glb → public/models/crisi_economica.glb
//
// Il peso sta quasi tutto in un posto solo: il tappo a corona, 107.702
// vertici su 121.412 totali — una capsula alta un centimetro modellata come
// se dovesse reggere un primo piano cinematografico. Vetro ed etichetta, che
// sono ciò che si guarda davvero, pesano insieme meno di un decimo. Quindi si
// semplifica SOLO il tappo: toccare l'etichetta vorrebbe dire sgranare il
// testo stampato, che negli step 2–5 è il soggetto dell'inquadratura.
//
// I nomi dei nodi del file originale sono quelli usciti da Blender, uno dei
// quali con i byte corrotti ("\uFFFD\uFFFD..._0"). Qui vengono riscritti in
// `vetro` / `tappo` / `etichetta`: sono l'unico aggancio che il codice ha sul
// file, meglio che siano stabili e leggibili.

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, weld, prune, simplifyPrimitive, meshopt, textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = 'assets-src/Crisi_Economica_etichettata.glb'
const DST = 'public/models/crisi_economica.glb'

// Quanti vertici deve restare al tappo. 10k è il punto in cui la corona resta
// tonda e la zigrinatura si legge ancora: sotto gli 8k il bordo inizia a
// poligonare e in primo piano si vede.
const CAP_TARGET_VERTS = 10_000
// Errore massimo ammesso dal semplificatore, come frazione del raggio del
// mesh. Molto stretto: il tappo si guarda da vicino.
const CAP_ERROR = 0.0005

// Nomi stabili con cui il codice ritrova i pezzi (vedi bottleAssembly.ts).
const NOMI = { 'Object_0': 'vetro', 'Object_0.002': 'tappo', 'Etichetta avvolta - fronte e ingredienti retro': 'etichetta' }

const kb = (n) => (n / 1024).toFixed(0) + ' KB'

/**
 * Ricalcola le normali di UNA primitiva, lisce, senza spacchettarla.
 *
 * Non uso `normals()` di gltf-transform perché fa due cose che qui fanno
 * danno: chiama `unweld()` sull'intero documento — gonfiando anche vetro ed
 * etichetta, che non c'entrano nulla — e produce normali piatte, che su un
 * metallo lucido con 20k triangoli danno un tappo sfaccettato.
 *
 * Qui invece: somma delle normali di faccia su ogni vertice, pesate dall'area
 * (il prodotto vettoriale non normalizzato ha già modulo 2·area, quindi la
 * pesatura viene gratis) e normalizzazione finale. I triangoli grandi contano
 * più dei piccoli, che è ciò che rende continua la superficie.
 */
function normaliLisce(doc, prim) {
  const pos = prim.getAttribute('POSITION')
  const idx = prim.getIndices()
  if (!idx) throw new Error('normaliLisce: la primitiva non è indicizzata')
  const n = pos.getCount()
  const P = new Float32Array(n * 3)
  const N = new Float32Array(n * 3)
  const v = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    pos.getElement(i, v)
    P[i * 3] = v[0]; P[i * 3 + 1] = v[1]; P[i * 3 + 2] = v[2]
  }
  for (let t = 0; t < idx.getCount(); t += 3) {
    const a = idx.getScalar(t) * 3, b = idx.getScalar(t + 1) * 3, c = idx.getScalar(t + 2) * 3
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2]
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2]
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x
    for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz }
  }
  for (let i = 0; i < n * 3; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1
    N[i] /= l; N[i + 1] /= l; N[i + 2] /= l
  }
  prim.setAttribute('NORMAL', doc.createAccessor().setArray(N).setType('VEC3'))
}

await MeshoptSimplifier.ready
await MeshoptEncoder.ready

// L'encoder va registrato sull'IO, non solo passato a meshopt(): è in fase di
// scrittura che l'estensione lo cerca, e senza muore con un `encodeFilterOct`
// undefined molto poco esplicativo.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(SRC)
const root = doc.getRoot()

// --- rinomina: il mesh dà il nome anche al nodo che lo porta, così dopo il
// flatten (che sposta i nodi sotto la scena) l'aggancio regge comunque
for (const mesh of root.listMeshes()) {
  const nuovo = NOMI[mesh.getName()]
  if (!nuovo) {
    console.warn(`optimize-glb: mesh inattesa "${mesh.getName()}", la lascio com'è`)
    continue
  }
  mesh.setName(nuovo)
  for (const node of root.listNodes()) {
    if (node.getMesh() === mesh) node.setName(nuovo)
  }
}

const tappo = root.listMeshes().find((m) => m.getName() === 'tappo')
if (!tappo) {
  console.error('optimize-glb: non trovo il tappo, il file di partenza è cambiato')
  process.exit(1)
}

const primaVerts = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + p.getAttribute('POSITION').getCount(), 0), 0)

// --- pulizia e bake delle trasformazioni annidate (scale 0,03 / 0,0036 ×
// 11,56: tre livelli che si annullano a vicenda e intanto rovinano le normali)
await doc.transform(dedup(), flatten())

// --- il nodo del problema: il tappo non si salda.
//
// `weld()` fonde solo vertici identici bit per bit, e il tappo esce dalla
// scultura con normali spezzate su ogni faccia e UV che non servono a nessuno
// (il suo materiale è rosso metallico senza alcuna texture). Risultato: 107k
// vertici che restano 107k, e il semplificatore si pianta a 50k qualunque
// errore gli si conceda — non ha spigoli da collassare.
//
// Togliendo i due attributi inutili la saldatura scende a 64k e da lì la
// semplificazione arriva dove deve. Le normali si ricalcolano dopo.
const prim = tappo.listPrimitives()[0]
prim.setAttribute('TEXCOORD_0', null)
prim.setAttribute('NORMAL', null)
await doc.transform(weld())

const prima = prim.getAttribute('POSITION').getCount()
simplifyPrimitive(prim, {
  simplifier: MeshoptSimplifier,
  ratio: CAP_TARGET_VERTS / prima,
  error: CAP_ERROR,
})
const dopo = prim.getAttribute('POSITION').getCount()
console.log(`tappo: saldato a ${prima}, semplificato a ${dopo} vertici`)

// Normali nuove, lisce. Si perde il taglio netto sulla piega delle 21
// scanalature della corona: la superficie ondula ancora (le posizioni sono
// quelle), ma l'ondulazione è sfumata invece che spigolosa. Su un metallo con
// clearcoat e riflessi lunghi si legge poco, ed è il prezzo per passare da
// 107k vertici a 10k su nove bottiglie in scena. La manopola per tornare
// indietro è CAP_TARGET_VERTS qui sopra.
normaliLisce(doc, prim)

await doc.transform(
  // PNG → WebP: l'etichetta è una stampa, non una foto, e a 92 non si vede
  // differenza. La risoluzione resta quella: 2008 px sono già pochi per i
  // primi piani, ridurla peggiorerebbe l'unica cosa che si legge.
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92 }),
  // dopo la semplificazione restano accessor e materiali orfani
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
)

mkdirSync(dirname(DST), { recursive: true })
await io.write(DST, doc)

const dopoVerts = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + p.getAttribute('POSITION').getCount(), 0), 0)
const src = statSync(SRC).size
const dst = statSync(DST).size
console.log(`vertici: ${primaVerts} → ${dopoVerts}`)
console.log(`file:    ${kb(src)} → ${kb(dst)}  (${(100 - (dst / src) * 100).toFixed(1)}% in meno)`)
for (const t of doc.getRoot().listTextures()) {
  console.log(`texture: ${t.getMimeType()} ${t.getSize().join('×')} ${kb(t.getImage().byteLength)}`)
}
if (dst > 1.2 * 1024 * 1024) {
  console.error(`optimize-glb: ${kb(dst)} supera il budget di 1,2 MB`)
  process.exit(1)
}

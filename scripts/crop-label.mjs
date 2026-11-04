// Ritaglia un rettangolo dalla texture dell'etichetta e lo salva come WebP con
// alpha (task 8.19).
//
// Il logotipo "CRISI ECONOMICA" vettoriale non c'è: lo si prende dalla texture
// originale, che ha il fondo della zona fronte trasparente. Il problema sono i
// fulmini rossi che passano **dietro** le lettere: nel ritaglio ne restano dei
// pezzi, con il loro contorno nero. La pulizia tiene solo l'intorno dei pixel
// bianchi delle lettere (una maschera dilatata, che si porta dietro il
// contorno nero delle lettere ma non i fulmini lontani) e spegne il rosso.
//
// Parametrico sul rettangolo: il task 8.24 lo riusa per le fasce del retro.
//
//   node scripts/crop-label.mjs                      # il logotipo
//   node scripts/crop-label.mjs x0 y0 x1 y1 out.webp [--raw]
//
// `--raw` salta la pulizia: per le fasce del retro, che non hanno fulmini.

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = 'assets-src/Crisi_Economica_etichettata.glb'
const TEXTURE = 'CRISI_ECONOMICA_etichetta_originale'

// Il logotipo, misurato il 2026-10-08: il bianco pieno delle lettere sta in
// x 134–652, y 246–479; ~14 px di margine per il contorno nero.
const LOGOTIPO = { x0: 120, y0: 232, x1: 666, y1: 493, out: 'public/images/crisi-economica-logotipo.webp' }

/** un pixel è "lettera" se è bianco pieno e opaco */
const BIANCO = { alpha: 200, rgb: 225 }
/** un pixel è "fulmine" se è rosso deciso */
const ROSSO = { r: 150, gb: 110 }
/** quanto la maschera delle lettere si allarga per prendere il contorno nero */
const DILATA = 10
const QUALITA = 90

const argv = process.argv.slice(2)
const raw = argv.includes('--raw')
const pos = argv.filter((a) => a !== '--raw')
const box = pos.length >= 5
  ? { x0: +pos[0], y0: +pos[1], x1: +pos[2], y1: +pos[3], out: pos[4] }
  : LOGOTIPO

await MeshoptDecoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(SRC)
const tex = doc.getRoot().listTextures().find((t) => t.getName() === TEXTURE)
if (!tex) throw new Error(`crop-label: texture "${TEXTURE}" non trovata in ${SRC}`)

const width = box.x1 - box.x0
const height = box.y1 - box.y0
const { data } = await sharp(Buffer.from(tex.getImage()))
  .ensureAlpha()
  .extract({ left: box.x0, top: box.y0, width, height })
  .raw()
  .toBuffer({ resolveWithObject: true })

if (!raw) {
  // Maschera a un canale **in negativo**: 0 sui pixel bianchi delle lettere,
  // 255 altrove. `dilate()` di sharp allarga il nero, non il bianco (provato
  // sulla 0.35.5: un pixel bianco su nero sparisce, uno nero su bianco
  // diventa un quadrato), e senza `b-w` l'uscita torna a tre canali.
  const lettere = Buffer.alloc(width * height, 255)
  for (let i = 0; i < lettere.length; i++) {
    const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4)
    if (a > BIANCO.alpha && r > BIANCO.rgb && g > BIANCO.rgb && b > BIANCO.rgb) lettere[i] = 0
  }
  const negativo = await sharp(lettere, { raw: { width, height, channels: 1 } })
    .dilate(DILATA)
    // la dilatazione è a gradini di pixel: un filo di sfocatura fa da antialias
    .blur(1)
    .toColourspace('b-w')
    .raw()
    .toBuffer()
  const maschera = negativo.map((v) => 255 - v)
  for (let i = 0; i < maschera.length; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const rosso = r > ROSSO.r && g < ROSSO.gb && b < ROSSO.gb
    data[i * 4 + 3] = rosso ? 0 : Math.min(data[i * 4 + 3], maschera[i])
  }
}

mkdirSync(dirname(box.out), { recursive: true })
const info = await sharp(data, { raw: { width, height, channels: 4 } })
  .webp({ quality: QUALITA, alphaQuality: 100 })
  .toFile(box.out)
console.log(`crop-label: ${box.out} ${info.width}×${info.height}, ${(info.size / 1024).toFixed(1)} KB`)

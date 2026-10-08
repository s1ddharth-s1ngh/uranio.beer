// Il budget 9.1 della spec: JavaScript iniziale < 350 KB gzip, debug escluso.
//
// "Iniziale" = tutto quello che si scarica prima del primo frame composto
// della home: l'entry con i suoi import statici, più i chunk lazy che la home
// chiede subito al mount (`EAGER`) con i loro import statici. Il grafo lo dà
// il manifest di vite (`build.manifest` in vite.config.ts).
//
//   npm run build && node scripts/measure-bundle.mjs

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const BUDGET_KB = 350

// Lazy ma chiesti appena la home monta, prima che il canvas disegni. Un chunk
// che monta solo dopo il primo frame (PostFX, task 8.27) non sta qui.
const EAGER = ['src/pages/Experience.tsx']

const manifest = JSON.parse(readFileSync(join(DIST, '.vite', 'manifest.json'), 'utf8'))
const entry = Object.keys(manifest).find((k) => manifest[k].isEntry)
if (!entry) {
  console.error('measure-bundle: nessuna entry nel manifest')
  process.exit(1)
}

const presi = new Set()
const visita = (key) => {
  if (presi.has(key) || !manifest[key]) return
  // il debug vive solo dietro `?debug`: per la spec non conta
  if (manifest[key].src?.startsWith('src/debug/')) return
  presi.add(key)
  for (const k of manifest[key].imports ?? []) visita(k)
}
visita(entry)
for (const k of EAGER) visita(k)

const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length / 1024
const righe = [...presi]
  .map((k) => ({ file: manifest[k].file, kb: gz(manifest[k].file) }))
  .sort((a, b) => b.kb - a.kb)
const totale = righe.reduce((s, r) => s + r.kb, 0)

for (const r of righe) console.log(`${r.kb.toFixed(1).padStart(7)} KB  ${r.file}`)
console.log(`${totale.toFixed(1).padStart(7)} KB  totale (budget ${BUDGET_KB})`)

// i chunk lazy che restano fuori, per sapere cosa si è rimandato
const fuori = Object.keys(manifest)
  .filter((k) => !presi.has(k) && manifest[k].file.endsWith('.js'))
  .map((k) => ({ file: manifest[k].file, kb: gz(manifest[k].file) }))
  .sort((a, b) => b.kb - a.kb)
console.log('\nfuori dal primo frame:')
for (const r of fuori) console.log(`${r.kb.toFixed(1).padStart(7)} KB  ${r.file}`)

process.exit(totale <= BUDGET_KB ? 0 : 1)

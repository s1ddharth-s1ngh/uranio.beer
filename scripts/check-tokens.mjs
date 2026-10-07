// La palette vive due volte: in `src/config/theme.ts` (per shader e tween) e
// in `src/styles/tokens.css` (per il CSS, che deve essere valido già al primo
// paint). Due copie derivano, prima o poi, e il giorno in cui il rosso dello
// shader non è più il rosso della barra nessuno capisce perché.
//
// Questo script è la rete: gira dentro `npm run build` e la fa fallire se i
// due file non dicono la stessa cosa. `theme.ts` è la fonte di verità.

import { readFileSync } from 'node:fs'

const TS = 'src/config/theme.ts'
const CSS = 'src/styles/tokens.css'

// camelCase → kebab-case, la convenzione che lega `redMid` a `--u-red-mid`
const tokenName = (k) => `--u-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`
// `fog1` → `--u-fog-1`: la cifra finale è un pezzo del nome, non del valore
const normalise = (n) => n.replace(/([a-z])(\d)$/, '$1-$2')

const ts = readFileSync(TS, 'utf8')
const css = readFileSync(CSS, 'utf8')

const block = ts.match(/export const COLORS = \{([\s\S]*?)\} as const/)
if (!block) {
  console.error(`check-tokens: non trovo l'oggetto COLORS in ${TS}`)
  process.exit(1)
}

const wanted = new Map()
for (const [, key, hex] of block[1].matchAll(/^\s*(\w+):\s*"(#[0-9a-fA-F]{3,8})"/gm)) {
  wanted.set(normalise(tokenName(key)), hex.toLowerCase())
}

const got = new Map()
for (const [, name, hex] of css.matchAll(/^\s*(--u-[\w-]+):\s*(#[0-9a-fA-F]{3,8});/gm)) {
  got.set(name, hex.toLowerCase())
}

const errori = []
for (const [name, hex] of wanted) {
  if (!got.has(name)) errori.push(`manca ${name} in ${CSS} (vale ${hex})`)
  else if (got.get(name) !== hex) errori.push(`${name}: ${CSS} dice ${got.get(name)}, ${TS} dice ${hex}`)
}
for (const name of got.keys()) {
  if (!wanted.has(name)) errori.push(`${name} è in ${CSS} ma non in COLORS`)
}

if (errori.length) {
  console.error('check-tokens: palette disallineata\n  ' + errori.join('\n  '))
  process.exit(1)
}
console.log(`check-tokens: ${wanted.size} token allineati`)

# uranio.beer

Sito di Uranio: Vite + React + three.js, pubblicato su GitHub Pages.

## I due siti

GitHub Pages serve **un solo dominio per repository**: per questo il sito di
prova sta su un repo separato, non su un branch diverso di questo.

| | dominio | repo | comando |
|---|---|---|---|
| produzione | `www.uranio.beer` | `s1ddharth-s1ngh/uranio.beer` | `npm run deploy` |
| prova | `test.uranio.beer` | `s1ddharth-s1ngh/uranio-test` | `npm run deploy:test` |

Il sorgente è uno solo, questo: cambia solo la destinazione. `npm run
deploy:test` builda, scrive `test.uranio.beer` nel `CNAME` al posto di
`www.uranio.beer`, aggiunge un `robots.txt` che vieta l'indicizzazione (la
prova non deve finire su Google come doppione del sito vero) e pubblica sul
branch `gh-pages` dell'altro repo. **`npm run deploy` non viene toccato**: la
produzione si pubblica come prima.

DNS (OVH): `www` e `test` sono due CNAME verso `s1ddharth-s1ngh.github.io.`

### Se il deploy dà 403

Il credential manager di Windows ha salvato l'account `Singh-Growe`, che non ha
scrittura su questi repo. Si risolve una volta sola: Gestione credenziali →
Credenziali Windows → elimina `git:https://github.com`, poi rilancia il
deploy e autenticati come `s1ddharth-s1ngh`. In alternativa, per un colpo
solo, si passa un token nell'URL: `npx gh-pages -d dist -r
"https://s1ddharth-s1ngh:TOKEN@github.com/s1ddharth-s1ngh/uranio-test.git"`
(poi `rm -rf node_modules/.cache/gh-pages`, che si tiene l'URL col token).

## Attenzione a `public/`

Tutto ciò che sta in `public/` finisce online. I PDF degli ordini che ogni
tanto atterrano lì sono documenti personali: `scripts/postbuild.mjs` li toglie
dalla build (`ordine-*.pdf`), ma il posto giusto è fuori dal progetto.

## Comandi

```
npm ci               # la prima volta, o se node_modules manca
npm run dev          # dev server, esposto anche in rete locale
npm run build        # build di produzione
npm run build:test   # build del sito di prova (CNAME test + noindex)
npm run lint
npm run verify:core  # la logica pura in Node: motore a step, keyframe, carosello
npm run verify:glb   # il modello e la sua preparazione (bbox, scala, materiali)
npm run optimize:glb # assets-src/*.glb -> public/models/crisi_economica.glb
npm run qa           # percorso Playwright 0 -> 6 -> 0, schermate in qa/screens
```

`verify:core` e `verify:glb` girano senza browser e vanno lanciati prima di
ogni commit insieme a `tsc -b`, `eslint src` e `build` (guardando l'esito con
`echo $?`). `optimize:glb` serve solo se cambia il GLB sorgente. `qa` fa il
build in `qa/.dist` (non tocca `dist/`), lo serve con `vite preview` sulla
porta 4318 e percorre con la tastiera hero → step 0 → 6 → 0 → hero a
1440×900, 390×844 e 768×1024; la prima volta serve `npx playwright install
chromium`. Su Windows usa la GPU vera (ANGLE D3D11); altrove swiftshader,
in software: a ~3 fps GSAP rallenta il tempo e le transizioni durano molto
di più, ma le schermate restano vere.

## L'esperienza 3D

La home (`/`) ha tre sezioni: in cima il hero del sito (il logo Uranio 3D),
poi l'esperienza a step della bottiglia (`#esperienza`,
`src/pages/Experience.tsx`), poi "Chi siamo". Un gesto verso il basso nel
hero fa il passaggio animato all'esperienza; dallo step 0 un gesto verso
l'alto torna al hero; dal finale (step 6) la pagina riprende a scorrere da
sola. Chi possiede lo scroll lo decide `src/lib/pageScroll.ts`. La spec è `docs/URANIO_SCROLL_SPEC.md`, le
correzioni e le domande aperte sono in `docs/AUDIT.md`, lo stato del lavoro
in `docs/CONTINUA.md`.

**Ogni numero sta in `src/config/`**: keyframe e ancore della bottiglia in
`keyframes.ts`, luci in `lights.ts`, materiali in `materials.ts`, durate e
colori in `theme.ts` (un colore nuovo va anche in `tokens.css`, o il build
fallisce).

### `?debug`

- `?debug` apre il pannello lil-gui con stats-gl: ogni modulo iscrive lì le
  sue manopole. Il pulsante **"copia keyframe (JSON)"** copia lo stato di
  tutte le manopole: si regola a occhio, si copia e si incolla in
  `src/config/`. Le composizioni si regolano spostando le **ancore** (quale
  punto della bottiglia in quale punto dello schermo), non i pivot.
- `?debug=type` — provino tipografico.
- `?debug=bands` — la texture dell'etichetta con le quattro fasce disegnate
  sopra, e la fascia accesa in 3D che gira sulle quattro.
- `?debug=env` — due sfere di prova al posto della bottiglia per giudicare
  l'ambiente e le luci.
- `#step-N` nell'URL fa partire l'esperienza dallo step N (0–6).

### Testi e birre

- **Testi** degli step, del hero e del finale: `src/content/steps.it.ts`.
  Nessuna stringa visibile vive nei componenti.
- **Birre** del carosello: `src/config/beers.ts`. Oggi ce n'è una sola; per
  aggiungerne una basta una riga nell'elenco `BEERS` (nome, stile,
  gradazione, GLB, colore della rim light).

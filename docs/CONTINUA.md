# Continua da qui

Documento di passaggio di consegne, riscritto al task 8.18. Leggilo tutto,
poi **finisci il task 8.18 e vai avanti fino al 8.28**. La spec completa è
`docs/URANIO_SCROLL_SPEC.md`, le decisioni e le correzioni alla spec stanno in
`docs/AUDIT.md`: leggi entrambi prima di scrivere codice.

## Regola che vale su tutto

**Non fermarti e non fare domande. Finisci il lavoro.**

La regola 10.1.8 della spec (fermarsi a fine di ogni fase e mostrare
screenshot) resta **sospesa**: niente pause, niente conferme. Ogni dubbio
aperto ha già una risposta di default più sotto. Se incontri una scelta non
prevista, prendila tu, annotala in `docs/AUDIT.md` e tira dritto.

Un task = un commit, in italiano, all'imperativo, come già fatto. Resti su
`main`, non fai `push`. Niente `--amend`.

**Prima di ogni commit**, e guardando l'esito con `echo $?` e non con un
`grep` (vedi trappola 8 più sotto):

```sh
npx tsc -b            # deve uscire 0
npx eslint src        # deve uscire 0
npm run build         # deve uscire 0
npm run verify:core   # la logica pura in Node
npm run verify:glb    # il modello e la sua preparazione
```

Quando arrivi in fondo al 8.28, fermati e scrivi un resoconto finale di cosa
è stato fatto e cosa resta non verificabile.

## Dove sei

Fase A, B e C finite, fase D a metà. Diciotto commit su `main`:

| commit | task | cosa |
| --- | --- | --- |
| `6bb9576` | 8.1 | audit, spec versionata, GLB sorgente in `assets-src/` |
| `3a89d13` | 8.2 | dipendenze, `strict`, scheletro strati su `/esperienza` |
| `bc02fc5` | 8.3 | palette, Archivo variabile, `?debug=type` |
| `852ff4b` | 8.4 | GLB 5,8 MB → 320 KB |
| `bbfa639` | 8.5 | `Ticker`, `Viewport`, pannello debug + registro |
| `2c4b013` | 8.6 | `Progress` + `StepController` (motore a step) |
| `455acd5` | 8.7 | `config/bottle.ts`, `keyframes.ts`, `solvePivot`, `StateMapper` |
| `367eae1` | 8.8 | `Stage` (renderer + loop manuale), env map lightformer |
| `7b7b14a` | 8.9 | `prepareBottle` + materiali vetro/tappo/etichetta |
| `d34b69c` | 8.10 | shader reveal/focus/sweep + `?debug=bands` |
| `c419486` | 8.11 | spot sul tappo che segue la cima, rim light, fill |
| `d28875c` | 8.12 | sfondo a tre atmosfere su canvas proprio |
| `856e508` | fix | apici inversi nei commenti dentro il GLSL |
| `da347f4` | 8.13 | carosello: anello, trascinamento, scatto, uscita |
| `deebe1c` | 8.14 | faro e piedistallo (solo primitive) |
| `f405cc9` | 8.15 | bloom + vignetta + grana in un `EffectPass` |
| `deda33d` | 8.16 | header HUD, angolari, trattini, lettere |
| `e5ad843` | 8.17 | barra di progresso e icone degli step |

### Il task 8.18 è scritto ma NON verificato e NON committato

Nell'albero di lavoro ci sono già, da finire:

- `src/ui/StepText.ts` — la classe che anima i testi (uscita a righe verso
  l'alto con maschera, entrata dal basso con sfocato, tag barrato). È una
  classe e non un componente React di proposito: durante una transizione
  **esistono due blocchi insieme**, il vecchio che esce e il nuovo che entra
  al 45% dell'uscita, e il blocco vecchio è un nodo che la sua timeline si
  porta via da sé. Con React servirebbe una coda di blocchi uscenti in stato.
- `src/ui/StepText.module.css` — blocco a `left: 10vw`, centrato al 45%,
  angolari piccoli, tag rosso + etichetta bianca + riga barrata; su mobile
  scende in basso.
- `src/ui/StepTextLayer.tsx` — il contenitore React: reagisce a `step:leave`
  (la **partenza** della transizione) e mostra il testo solo per gli step
  1–5. Aspetta `useFontsReady` perché `SplitText` misura le righe nel momento
  in cui gira.
- `src/config/text.ts` — i tempi (uscita 0,4 s stagger 0,05; entrata al 45%
  della durata, 0,7 s stagger 0,07; tag 0,35 s; barratura 0,45 s).
- `src/pages/Experience.tsx` — già modificato per montare `StepTextLayer`
  nello strato `.stage-ui`.

**Cosa resta da fare sul 8.18**: lanciare `npx tsc -b`, `npx eslint src`,
`npm run build`, sistemare quello che esce (l'unico sospetto è ESLint, vedi
trappola 5) e committare. Poi 8.19.

## Risposte di default alle domande aperte

Non chiedere nessuna di queste. Usa la risposta e vai avanti.

| Domanda | Risposta da usare |
| --- | --- |
| Branch `feat/scroll-3d`? | **No.** `CLAUDE.md` impone `main`. |
| Logo Uranio in SVG? | **Non c'è.** `src/assets/uranio-mark.png` è già usato come segnaposto nell'header (schiarito via CSS, con il TODO accanto). |
| Logotipo "CRISI ECONOMICA" vettoriale? | **Non c'è.** Ritaglialo dalla texture dell'etichetta (zona fronte, x 20–860 su 2008 px) con `sharp` in uno script, output in `public/images/`. Serve al task 8.19. |
| Testi confermati dal birrificio? | **No, e non serve aspettare.** `src/content/steps.it.ts` così com'è. |
| File audio? | **Non ci sono.** Il task 8.25 è opzionale: il toggle è già fatto e persistente (`src/hooks/useAudioEnabled.ts`), mancano solo i suoni. Lascialo documentato, non inventare suoni. |
| Cancellare i GLB morti in `public/3d/`? | **No.** Non hai l'autorizzazione. Lasciali. |
| Destinazione di "DOVE TROVARLA"? | Ancora `#contatti`, già in `steps.it.ts`. |
| Etichetta a 4096 px? | **Non c'è.** Resta a 2008×827. |
| Vulnerabilità di `react-router-dom`? | **Non toccarle.** Decide il proprietario. |
| Lucide per le icone? | **Già risolto**: le quattro icone sono disegnate a mano in `src/ui/icons.tsx`, nessuna dipendenza nuova. |

## Com'è fatto il codice adesso

```
src/
  config/            la fonte di verità di ogni numero (regola 10.1.4)
    theme.ts         colori, durate, easing, soglie dello scroll
    bottle.ts        misure del GLB, mappatura etichetta, FASCE, uniform
    keyframes.ts     i 7 keyframe desktop + mobile, le finestre dei segmenti
    solvePivot.ts    ancora (punto bottiglia → punto schermo) → posizione pivot
    materials.ts     vetro, tappo, etichetta
    lights.ts        env rig, spot, rim, fill
    props.ts         faro e piedistallo
    beers.ts         elenco birre + forma e fisica dell'anello
    background.ts    pesi e colori dello sfondo
    postfx.ts        bloom, vignetta, grana
    text.ts          tempi dei testi (task 8.18)
  core/              TypeScript puro, FUORI da React, eseguibile in Node
    Ticker.ts        un solo loop (gsap.ticker)
    Viewport.ts      misura, tetto DPR, breakpoint, debounce 100 ms
    Progress.ts      `p`, lock, inversione, rimbalzo, durate
    StepController.ts rotella/touch/tastiera → step (logica pura separata)
    StateMapper.ts   p → stato della scena (oggetto riusato, zero allocazioni)
    Carousel.ts      anello + trascinamento + aggancio
  gl/                componenti R3F
    Stage.tsx        Canvas (frameloop="never"), renderer, loop manuale
    Environment.tsx  env map da lightformer
    Lights.tsx       spot che segue la cima, rim, fill
    Bottle.tsx       la protagonista: copia stato e maschere ogni frame
    Carousel.tsx     le altre bottiglie dell'anello
    HeroProps.tsx    faro e piedistallo
    Background.ts    classe con WebGLRenderer proprio su #bg
    BackgroundLayer.tsx
    PostFX.tsx       composer (import dinamico)
    prepareBottle.ts bake, materiali, cloni (three puro, verificabile in Node)
    materials/patchBottle.ts  gli shader innestati con onBeforeCompile
  ui/
    Hud.tsx          header, angolari, trattini, lettere, menu
    ProgressBar.tsx  barra (scrive una variabile CSS nel tick, non in React)
    StepIcons.tsx    le quattro icone-navigazione
    icons.tsx        i quattro disegni SVG
    StepText.ts      i testi degli step (task 8.18, da finire)
  hooks/
    useViewport.ts   `sharedViewport()` + hook
    useStepEngine.ts monta il motore, hash dell'URL, spia di debug
    useCarouselDrag.ts gesti orizzontali dell'hero
    useAudioEnabled.ts toggle audio persistente
  debug/
    registry.ts      le manopole si iscrivono qui (nessuna dipendenza)
    DebugPanel.tsx   lil-gui + stats-gl, solo con ?debug (import dinamico)
    BandsProbe.tsx   ?debug=bands: la texture con le fasce disegnate sopra
    EnvProbe.tsx     ?debug=env: due sfere di prova
    TypeSpecimen.tsx ?debug=type
scripts/
  optimize-glb.mjs   npm run optimize:glb
  verify-glb.mts     npm run verify:glb   (modello + prepareBottle)
  verify-core.mts    npm run verify:core  (tutta la logica pura)
  check-tokens.mjs   gira dentro npm run build
```

### Le cinque cose da sapere sull'architettura

1. **Lo stato 3D è una funzione pura di `p`.** `StateMapper.apply(p)` non
   tocca la scena: restituisce un oggetto (sempre lo stesso, riusato) e sono
   i componenti `gl/` a copiarselo. Andata, ritorno, inversione e salti
   escono di conseguenza.
2. **Un solo loop.** Il Canvas R3F gira con `frameloop="never"` e lo avanza
   il nostro ticker (`gl/Stage.tsx` → `Driver`), nell'ordine: calcola lo
   stato da `p`, copia la camera, disegna. Con due rAF la scena rischiava di
   disegnare la `p` del frame prima.
3. **`core/` non importa React e si esegue in Node.** È il solo modo di
   provare qualcosa su questa macchina. I moduli di `core/` e `config/` si
   importano fra loro **con l'estensione `.ts` esplicita**: senza, Node non
   li risolve.
4. **Le composizioni si dichiarano per ancore, non per posizioni.** Per ogni
   step: quale punto della bottiglia in quale punto dello schermo. I pivot li
   risolve `solvePivot` a ogni resize. I keyframe mobile sono solo ancore
   diverse.
5. **Niente numeri magici fuori da `src/config/`** (regola 10.1.4), e
   `src/config/theme.ts` è la fonte dei colori: se ne aggiungi uno, va anche
   in `tokens.css` o `npm run build` fallisce (`scripts/check-tokens.mjs`).
   I colori che vivono **solo** negli shader (tinta del vetro, nebbia,
   pavimento) stanno negli altri file di config, non in `COLORS`.

## Fatti misurati, non li rimisurare

**GLB ottimizzato** — `public/models/crisi_economica.glb`, 320 KB, tre nodi
`vetro` / `tappo` / `etichetta`, ingombro `1,3050 × 4,1769 × 1,3080`.

Dopo `prepareBottle()` le tre mesh stanno nello **stesso spazio oggetto** e
cadono esattamente sulle costanti di `config/bottle.ts`:

- vetro 0,0037 → 4,1388
- tappo 4,0475 → 4,1807, raggio 0,346
- etichetta 0,4550 → 1,7326, raggio 0,6588 dopo la scala dell'1,2% contro
  0,6556 del vetro alla stessa altezza (lo z-fighting è escluso per
  costruzione, con 0,003 di margine)
- centro geometrico y = 2,0922; ruotando il pivot di π la deriva in altezza è
  0, in orizzontale 0,0062 (è l'asimmetria della bottiglia, non un errore)

**Etichetta**: `y = 1,7327 − 1,2777 · v`, misurato per regressione.
u 0,22 → θ +1,5° (il fronte guarda la camera con `rotation.y = 0`),
u 0,795 → θ 180,2° (il retro), vetro nudo fra 78°–113° e 235°–303°.

**Le quattro fasce** si ricavano dai pixel della texture (85–200, 218–312,
335–550, 565–745) e vengono 1,5125 / 1,3233 / 1,0491 / 0,7206 con le mezze
altezze della tabella 3.4: coincidono con la spec. Verificate dentro
l'etichetta con tutta la loro mezza altezza.

**I pivot risolti** a 1440×900 sono (0; 0,45), (0,67; −0,50), (0,71; 0,84),
(0,71; 1,03), (0,71; 1,20), (0,70; 1,54), (0; −0,15). La colonna "pivot
atteso" della tabella 7.2 non torna sulle x degli step 2–5 (0,30 fisso):
**non si corregge**, sono le ancore la fonte di verità e `verify:core`
verifica la proprietà giusta, cioè che il punto ancorato riproiettato in
camera cada entro 1e-3 dal punto di schermo dichiarato, a 1440×900, 2560×1080
e 390×844.

## Trappole già pagate, non ricascarci

1. **Il GLB è quantizzato (`KHR_mesh_quantization`), non solo compresso
   meshopt.** Le posizioni sono `Int16` normalizzati e **interlacciati**:
   `geometry.applyMatrix4()` ci scrive float dentro, li tronca e la bottiglia
   esce **alta 1,92 invece di 4,18** senza alcun errore. Gli attributi vanno
   ricostruiti in `Float32` prima del bake (`dequantizza()` in
   `prepareBottle.ts`).
2. **Non ricalcolare le normali dopo il bake.** `applyMatrix4` le trasforma
   con la matrice normale (corretto anche per la scala non uniforme del
   tappo) e three le normalizza nel vertex shader;
   `computeVertexNormals()` butterebbe via le normali lisce costruite a mano
   dal task 8.4 per la zigrinatura della corona.
3. **`material.clone()` si porta dietro `onBeforeCompile`** con la chiusura
   sugli uniform dell'originale: nei cloni del carosello la patch va
   ri-innestata o tutte le bottiglie pilotano la stessa luce.
4. **`erasableSyntaxOnly` è attivo**: niente parameter properties
   (`constructor(private x)`), vanno dichiarate a mano.
5. **ESLint 10 ha `react-hooks/immutability`, `purity`, `set-state-in-effect`
   e `use-memo`.** Quindi, nei componenti: non scrivere proprietà di valori
   che arrivano dal render (passali a una **funzione di modulo** che muta lei
   — è il trucco di `applyMasks`, `disponi`, `posiziona`), non chiamare
   `Math.random()` durante il render, non fare `setState` dentro un effetto
   (usa l'inizializzatore pigro di `useState`), e passa a `useMemo` una
   funzione inline. I `ref` si possono mutare liberamente.
6. **`tween.isActive()` è falso fino al primo tick dopo la creazione**: il
   lock di `Progress` tiene un flag suo.
7. **Dentro i template literal del GLSL non si possono usare apici inversi**,
   nemmeno nei commenti: chiudono il literal e `tsc` non compila più.
8. **Non controllare l'esito dei comandi con `grep`**: `npm run build 2>&1 |
   grep -E "built in|error"` esce con successo anche quando il build
   fallisce, perché il grep ha trovato "error". Usa `echo $?`. È così che un
   commit rotto è passato (poi corretto da `856e508`).
9. **Heredoc bash e apostrofi italiani non vanno d'accordo**: per scrivere
   file con molto testo usa lo strumento di scrittura, non `cat <<EOF`.
10. **Niente browser su questa macchina, e niente `ffmpeg`.** La verifica si
    fa in Node: `verify:core` (motore, keyframe, carosello, shader) e
    `verify:glb` (modello, preparazione). Per il task 8.28 installa
    `@playwright/test` quando ci arrivi: se i browser non si scaricano,
    scrivi comunque lo script, lascialo nel repo e dichiara nel commit che
    non è stato eseguito. Non bloccarti.
11. **I sorgenti vanno in `scripts/`, non nello scratchpad**: da fuori dal
    progetto gli import bare (`three`, `@gltf-transform/core`) non risolvono.

## Cosa resta: dal 8.19 al 8.28

Leggi il testo completo di ogni task nella spec. Note da qui:

- **8.19 interfaccia dell'hero.** Serve il ritaglio del logotipo dalla
  texture (vedi domande aperte). Frecce a puntini ±120 px dalla protagonista
  che chiamano `sharedCarousel().nudge(±1)`, slider sincronizzato con
  `sharedCarousel().index`, "SCORRI PER SCOPRIRE" cliccabile che fa uno step
  avanti. Tutto esce nel segmento 0 → 1: usa `SceneState.props` o un peso
  derivato da `p` come fanno già gli altri strati.
- **8.20 finale.** `.bigword` è già un contenitore vuoto nello strato 2 di
  `Experience.tsx`. Oscillazione lenta della bottiglia: è la "vita a riposo"
  della spec 7.4, non ancora implementata da nessuna parte — va sommata
  sopra lo stato in `Bottle.tsx`, smorzata a zero mentre `p` si muove.
- **8.21 uscita verso il resto della pagina.** Qui l'esperienza si trasferisce
  in `src/pages/Home.tsx` al posto dell'hero attuale e la route
  `/esperienza` sparisce (togli anche `esperienza` da `ROUTE` in
  `scripts/postbuild.mjs`). La sezione "Chi siamo" **non si tocca** (regola
  10.1.10): diventa il contenuto sotto. `lib/heroTransition.ts` e
  `hooks/useHeroLock.ts` vanno riscritti. Attenzione: `Experience` è una
  route lazy in `App.tsx` proprio perché three+drei non finiscano nel bundle
  iniziale di tutto il sito (erano 373 KB gzip contro 87); quando va in home,
  tieni il Canvas in import dinamico o il budget 9.1 salta.
- **8.22 preloader.** Si **riveste** `src/components/Loader.tsx`, già
  agganciato al progresso reale dei GLB (`lib/assetProgress.ts` +
  `useProgress` di drei). Non riscriverlo.
- **8.23 responsive.** I keyframe mobile ci sono già (`KEYFRAMES_MOBILE`), le
  icone in riga e il testo in basso anche. Restano la sfumatura sotto il
  testo, `100svh`, safe area iOS e il tablet verticale.
- **8.24 accessibilità e fallback.** `prefers-reduced-motion` è già
  rispettato in `Progress` (durate a 0,45 s), nell'HUD e nei testi. Mancano
  il focus visibile su tutti i controlli, l'ordine di tabulazione e il
  fallback senza WebGL2.
- **8.25 audio (opzionale).** Il toggle e la persistenza ci sono. Mancano i
  file: lascia documentato.
- **8.26 birra dentro (opzionale).** `LatheGeometry` dal profilo 3.2.
- **8.27 performance.** Da fare: DPR adattivo (scende di 0,25 se il frame
  medio supera 20 ms per 2 s), sfondo a max 30 fps (il DPR 0,5 c'è già),
  pausa con tab nascosta, `IntersectionObserver`. **E il budget**: oggi la
  pagina dell'esperienza pesa ~373 KB gzip fra index, chunk suo e chunk
  condiviso di three/drei, contro i 350 della sezione 9.1. Il sospetto è
  `Environment` di drei: la spec 6.4 descrive comunque una PMREM fatta a mano
  da piani emissivi, che sono ~40 righe senza drei. Misura prima di riscrivere.
- **8.28 QA finale.** Script Playwright a 1440×900 e 390×844 che percorre 0 →
  6 → 0 con la tastiera aspettando `step:enter` (l'evento esiste su
  `sharedProgress()`), screenshot in `qa/screens/`, poi **guarda gli
  screenshot** e correggi i keyframe dove sbagliano. Aggiorna il `README`.

## Cosa resta non verificato a occhio

Su questa macchina non c'è un browser: **nessuno ha ancora visto niente**.
Tienine conto e dillo nei commit. In particolare, i primi numeri da ritoccare
guardando:

- `CAROUSEL.radius` (6): "si vedono sette bottiglie, le estreme tagliate dai
  bordi" è un giudizio visivo;
- `PROPS.faro.y` (3,9): il taglio del faro sul bordo alto del frame;
- `SPOT.gain` (10): l'intensità dello spot è una stima — con `decay: 0` i
  keyframe dicono "quanto forte" e il gain traduce in watt three;
- la soglia del bloom (0,85), alta di proposito: deve brillare solo il bordo
  del tappo, la lama di luce e il disco del faro;
- le fasce con `?debug=bands`, che disegna i quattro rettangoli sopra la
  texture vera e fa ciclare la fascia accesa in 3D;
- la zigrinatura del tappo dopo la semplificazione del task 8.4 (manopola
  `CAP_TARGET_VERTS` in `scripts/optimize-glb.mjs`).

Dove non puoi verificare, misura ciò che si può misurare in Node e scrivi
chiaramente nel commit cosa resta da guardare.

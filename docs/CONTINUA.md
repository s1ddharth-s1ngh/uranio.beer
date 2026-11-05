# Continua da qui

Documento di passaggio di consegne, riscritto al task 8.18 e portato allo
stato finale dal 8.28 il 2026-10-08. **Tutti i task, dal 8.1 al 8.28, sono
fatti**; i brief dal 8.19 in poi stanno in `docs/tasks/`, ognuno con la sua
sezione **Esito**, e il resoconto finale è in fondo a questo file. Per
riprendere in mano il progetto leggilo tutto. La spec completa
è `docs/URANIO_SCROLL_SPEC.md`, le decisioni e le correzioni alla spec stanno
in `docs/AUDIT.md`: leggi entrambi prima di scrivere codice.

## Regola che vale su tutto

**Non fermarti e non fare domande. Finisci il lavoro.**

La regola 10.1.8 della spec (fermarsi a fine di ogni fase e mostrare
screenshot) resta **sospesa**: niente pause, niente conferme. Ogni dubbio
aperto ha già una risposta di default più sotto. Se incontri una scelta non
prevista, prendila tu, annotala nella sezione **Esito** del tuo brief (il
8.28 le riporta tutte in `docs/AUDIT.md`) e tira dritto.

Un task = un commit, in italiano, all'imperativo, come già fatto. Resti su
`main` — oppure sul branch `task/8.xx` del worktree, se il proprietario ha
scelto di lavorare in parallelo (`docs/tasks/README.md`) — e non fai `push`.
Niente `--amend`.

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

## Terzo giro del 2026-11-05: vetro, grana, curve, costo

Un giro di pulizia su grafica e animazione, tutto guardato con Playwright
(schermate per step e transizioni fotogramma per fotogramma con
`page.clock`). Nessuna inquadratura e nessuna posa è cambiata: anello, fila e
primo piano restano quelli tarati sul riferimento nel giro prima.

1. **La toppa grigia sulla spalla.** Ogni bottiglia aveva sulla spalla una
   macchia grigia piatta col bordo a zigzag, e due righe grigie sui fianchi.
   Era l'ambiente: softbox e strisce erano piani pieni a bordo netto (il
   softbox 12 × 12), e sulla spalla del vetro, che ha pochi anelli di
   vertici, il bordo del riflesso seguiva le sfaccettature. Ora ogni piano ha
   una sfumatura radiale (`ENV.falloff`, la `makeGlowTexture` di sempre) e
   il softbox è 7 × 7: la spalla ha una luce morbida, i fianchi due lame da
   vetro. Si vede bene con `?debug=env`.
2. **La grana del fondo** si sommava in lineare, prima della conversione in
   sRGB: vicino al nero la conversione la moltiplicava per più di dieci, e il
   rosso degli step era un tessuto a puntini 2 × 2 (lo sfondo è a mezza
   risoluzione). Ora si somma dopo, in spazio display, a ±3 livelli: scioglie
   le bande e non si vede.
3. **Le transizioni scattavano.** La curva di `p` e quella delle finestre si
   moltiplicano: con `C0.65,0 0.18,1` e `power2.inOut` l'80% del moto della
   camera stava nel 12% della transizione (170 ms su 1,4 s, picco 12 volte la
   velocità media). Ora `C0.45,0 0.2,1` e `sine.inOut`: 23–25%, come un
   `expo.inOut`. Il conto è nel commento di `EASE_PATH` (`config/theme.ts`).
4. **La `transmission` del vetro è 0, e la birra non c'è più.** Con
   `#15110d` la luce trasmessa (moltiplicata per il colore) è lo 0,7%: a 0,2
   come a 0,75, con la birra sette volte più accesa, le schermate con e senza
   erano identiche. Costava un passaggio in più su tutti gli opachi. La birra
   ora esiste solo se il vetro trasmette (`prepareBottle`, e `verify:glb`
   controlla i due rami): per riaverla va schiarito il vetro, non solo
   alzato il numero.

**Costo GPU**, build di produzione, 1440×900, metodo `readPixels` (vedi più
sotto): il pavimento di Chromium headless con due canvas vuoti è già 17 ms,
quindi il costo della scena è la differenza.

| step | prima | dopo |
| --- | --- | --- |
| 0 anello | 32,9 ms | 28,1 ms |
| 1 fronte | 35,4 ms | 29,8 ms |
| 3 retro | 35,2 ms | 26,4 ms |
| 6 gamma | 48,3 ms | 31,4 ms |

Escluso misurando, per chi cerca il prossimo taglio: senza tutto il
post-processing, senza bloom o con la trasmissione a mezza risoluzione i
tempi non cambiavano. Il costo restante è il disegno delle bottiglie, e
scala coi pixel (720×450 → 18 ms, cioè il pavimento).

## Secondo giro del 2026-11-04: anello, tappo, cursore

Il proprietario ha guardato il primo giro (qui sotto) e l'ha trovato "per
nulla simile" a ciaoenergy.com. Ha chiesto, sulle sue schermate: tutte le
bottiglie in apertura con quella al centro, la faccia che segue il mouse, uno
scroll a scatti morbido verso la bottiglia grande con la luce sulla faccia,
il giro sul retro con le scritte evidenziate, il tappo che si apre sul retro
e si richiude quando arrivano tutte, poi le domande. E di togliere "Chi
siamo" (la bottiglia che apriva il tappo dopo le domande). I sette step ora:

| step | cosa |
| --- | --- |
| 0 | **anello**: tutte le bottiglie (7 su desktop, 5 su telefono), la protagonista al centro fra faro e piedistallo, il logotipo sul piedistallo (`HeroUi`, `gl/HeroProps.tsx`, `core/heroLayout.ts`) |
| 1 | **fronte**: su desktop il primo piano della faccia, come la lattina del riferimento (l'etichetta è più di un terzo dell'altezza, il collo esce in alto); la faccia guarda in alto a destra verso la luce (`face`; `rotation.x` negativo, lo controlla `verify:core`), il nome a sinistra (`HeroUi`). Sui formati verticali la bottiglia intera, tappo in quadro |
| 2–5 | il retro da vicino (camera a 6), una fascia accesa per step; all'1 → 2 **il tappo salta** (su desktop dal collo fuori quadro: entra in volo) e resta sospeso in alto a destra, davanti alla bottiglia |
| 6 | **gamma e finale insieme**: le altre tornano in fila, il tappo si richiude, "ZERO CRISI" dietro e le call to action |

Poi, a scroll nativo, le **domande frequenti**, ed è la fine della pagina:
`components/about/` non c'è più.

Lo studio del modello (mesh, misure, mappa dell'etichetta con le quattro
fasce) e il confronto step per step con il riferimento stanno in
`docs/STUDIO_MODELLO.md`.

Dove stanno le cose nuove:

- **anello e fila** sono gli stessi cloni in due pose, mescolate da
  `layout` (`core/Carousel.ts`: `ringPose`, `rowPose`, `slotPose`; misure
  in `RING` e `GAMMA` di `config/beers.ts`). L'anello diventa fila solo
  mentre le altre sono fuori scena (lo controlla `verify:core`);
- **cursore**: `core/Pointer.ts` + `config/pointer.ts`. Lo avanza `Stage.tsx`
  una volta per frame; la rotazione si moltiplica a sinistra della posa (in
  mondo), così gira verso il mouse qualunque lato guardi la camera.
  Ampiezza per step: `look` nei keyframe. Col moto ridotto è spento;
- **tappo**: la forma del volo è `core/Cap.ts` (funzione di `cap`, che
  arriva da `p` con la finestra `tappo`), i numeri in `config/cap.ts`, la
  geometria in `gl/Bottle.tsx` (`posaTappo`). Il tappo ha uniform suoi
  (`capUniforms`) perché le maschere leggono la posizione del modello e lo
  crederebbero ancora sul collo. Lo illumina lo spot della cima, che lo
  segue (`gl/Lights.tsx`);
- **luce sulla faccia**: non è una luce in scena ma un Lambert nello shader
  dell'etichetta (`uFace`, `FACE` in `config/lights.ts`);
- **fasce**: ogni fascia ha il suo arco (`angleHalf`, misurato sui pixel
  della texture), un centro più caldo e un alone colorato attorno.

**Tre cose scoperte, da sapere prima di toccare la scena:**

1. **In `npm run dev` la scena era ferma sul primo frame.** Il composer di
   `PostFX.tsx` stava in un `useMemo` con la pulizia in un effetto: lo
   `StrictMode` di React lo liberava e lo riusava. In produzione non
   succedeva, per questo il QA (che gira sulla build) passava. Ora il
   composer nasce e muore nello stesso effetto.
2. **Col post-processing le maschere lavorano in lineare**, non in spazio
   display come diceva la spec: la scena va in una render target e three
   salta tone mapping e conversione. `focusFloor` 0,06 era ~0,27 a schermo
   (la fascia "non si accendeva"); ora è 0,015.
3. **Il "60 fps" del giro precedente era il rAF di Chromium headless**, che
   va a 16,7 ms anche con la GPU indietro di secondi. Il costo GPU vero si
   misura svuotando la coda con un `readPixels` dopo una finestra di frame.
   Sulla GPU integrata di questa macchina (AMD Radeon, 1440×900, DPR 1),
   build di produzione, mediana di tre finestre:

   | | prima (31833fd) | ora |
   | --- | --- | --- |
   | apertura | 27,5 ms (bottiglia sola) | 35,3 ms (anello di 7) |
   | fronte | — | 30,2 ms |
   | retro | 33,7 ms | 33,6 ms |
   | gamma / finale | 50,5 ms | 44,1 ms |

   Le copie dell'anello e della fila sono senza `clearcoat` e la luce sulla
   faccia è nello shader per stare in questi numeri. La scena resta sopra i
   16 ms su questa GPU: il prossimo taglio è la `transmission` della
   protagonista su desktop, o il bloom a mezza risoluzione.

Il blocco di 1,5–2,5 s "passando dalla gamma al finale" annotato sotto non
ha più un passaggio in cui succedere: gamma e finale sono lo stesso step.

## Primo giro del 2026-11-04: la coreografia di ciaoenergy.com

Il proprietario ha chiesto di rifare l'esperienza sul modello di
<https://www.ciaoenergy.com/> (ispirazione, non copia). I sette step erano
(superati dal secondo giro, qui sopra):

| step | cosa |
| --- | --- |
| 0 | la bottiglia sola, grande e inclinata, nome a sinistra (`HeroUi`) |
| 1–4 | il retro, una fascia accesa per step, testo a sinistra e icone |
| 5 | la gamma: finito il giro arrivano le altre in fila curva (`core/Carousel.ts`, `GAMMA` in `config/beers.ts`) |
| 6 | il finale "ZERO CRISI" di sempre |

Poi, a scroll nativo, le **domande frequenti** (`components/faq/`, testi in
`content/faq.it.ts`, bozza da far validare) e "Chi siamo".

Tolti: l'anello trascinabile dell'hero (`useCarouselDrag`, frecce, slider),
faro e piedistallo (`gl/HeroProps.tsx`, `config/props.ts`), il primo piano col
tappo acceso (vecchio step 1), `core/heroLayout.ts`. L'ingresso
(`core/Intro.ts`) è la bottiglia che sale dal basso finendo un mezzo giro.

**Prestazioni.** Il colpevole era l'MSAA 4× del composer: su GPU integrata
la scena andava a 19–30 fps, con FXAA a 60 (misurato con Playwright su ANGLE
D3D11, 1440×900). Le bottiglie della gamma sono sempre `lowEnd` (niente
`transmission` né birra). **Resta aperto:** passando dalla gamma al finale
la GPU si ferma 1,5–2,5 s in un flush di raster di Chromium; c'era anche
prima del cambio (fra F4 e finale), non dipende né dalla scritta gigante né
dalla nebbia né dal clone della gamma. Da guardare su un PC vero.

## Cambio di direzione del 2026-10-08: il hero resta

Il proprietario del repo l'ha detto chiaro: **la prima sezione della home, il
hero col logo Uranio 3D, resta la prima sezione e non si cambia**. La spec
(e il task 8.21) la sostituivano con l'esperienza: non vale più.

- Il hero è tornato com'era prima del task 8.21, file per file (scene,
  `HeroLock`, `ScrollPill`, `InteractiveText`, `lib/heroTransition.ts`,
  `lib/scramble.ts`, verificati per hash). **Non toccarli.**
- L'esperienza a step è la **seconda** sezione (`<section id="esperienza">`
  in `pages/Home.tsx`), poi "Chi siamo" a scroll nativo.
- Fra le due c'è un **passaggio animato**: un gesto verso il basso nel hero
  (rotella, frecce, spazio; su touch il pulsante in basso) fa scorrere la
  pagina fino alla cima dell'esperienza con le dissolvenze di sempre del hero,
  e nell'ultimo tratto parte l'ingresso dell'esperienza (8.22). Dallo step 0
  un gesto verso l'alto rifà il passaggio al contrario.
- Lo scroll di tutta la home lo possiede `lib/pageScroll.ts` (stati `hero`,
  `passaggio`, `esperienza`, `pagina`); il motore a step lo usa come
  `ScrollHost`. `hooks/useHeroLock.ts` è diventato
  `hooks/useExperienceLock.ts` (ticker, header, ingresso).

## Dove sei

Tutte le fasi finite, dal 8.1 al 8.28. I commit su `main`:

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
| `41d7894` | 8.18 | testi degli step (commit dell'hook, messaggio automatico) |
| `909be62` | 8.20 | finale: scritta gigante e call to action |
| `b4e2d63` | 8.21 | dallo scroll a step allo scroll nativo dopo il finale |
| `c60401f` | 8.25 | audio, solo documentazione (`docs/AUDIO.md`) |
| `418fe0f` | 8.26 | birra ambra dentro la bottiglia |
| `cca3341` | 8.23 | keyframe e layout mobile e tablet |
| `fd705c8` | 8.24 | tastiera, screen reader, moto ridotto, fallback senza WebGL |
| `09cbee4` | 8.27 | DPR adattivo, budget, caricamento pigro |
| `b8673b9` | home | il hero del sito torna prima sezione, passaggio animato |
| `214be96` | fix | budget del primo frame rimisurato sul hero |
| — | 8.28 | percorso Playwright, schermate, correzioni, checklist |

Il 8.19 (interfaccia dell'hero) e il 8.22 (preloader e ingresso) sono stati
eseguiti nella stessa cartella in parallelo e, quando il 8.28 ha committato,
erano ancora nell'albero di lavoro: le schermate di `qa/screens/` li
comprendono. Il loro commit è dei loro autori.

### Il task 8.18

È nello storico come `41d7894 autocommit …`: il commit col messaggio giusto
era mancato, e la storia non si riscrive. Verificato il 2026-10-08: `tsc -b`,
`eslint src`, `npm run build`, `verify:core` e `verify:glb` escono 0. Nessuno
l'ha visto in un browser. I pezzi:

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
- `src/pages/Experience.tsx` — monta `StepTextLayer` nello strato
  `.stage-ui`.

## Risposte di default alle domande aperte

Non chiedere nessuna di queste. Usa la risposta e vai avanti.

| Domanda | Risposta da usare |
| --- | --- |
| Branch `feat/scroll-3d`? | **No.** `CLAUDE.md` impone `main`. L'unica eccezione possibile sono i worktree `task/8.xx` per lavorare in parallelo, e la decide il proprietario (`docs/tasks/README.md`). |
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
    StepText.ts      i testi degli step (task 8.18)
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
10. **Il browser c'è, ma è headless.** `npm run qa` usa il Chromium di
    Playwright (`npx playwright install chromium` la prima volta). Da solo
    disegna WebGL con swiftshader, in software: ~3 fps a 1440×900, e con
    frame oltre i 500 ms il `lagSmoothing` di GSAP rallenta il tempo, una
    transizione dura 9 s e gli `waitFor` scadono. Con `--use-angle=d3d11`
    (già in `qa/playwright.config.ts` su Windows) usa la GPU integrata AMD:
    ~35–41 fps. Il percorso gira sul **build** in `qa/.dist` e non sul dev
    server: con sessioni parallele l'HMR ricarica la pagina a metà. Niente
    `ffmpeg`, quindi niente video: le cose in movimento restano da guardare
    su un dispositivo.
13. **Un `<canvas>` con `inset: 0` non si stira**: è un elemento sostituito e
    resta grande quanto il suo buffer. Servono `width`/`height: 100%`. È
    così che lo sfondo a DPR × 0,5 copriva un quarto dello schermo, e in Node
    non si vedeva.
14. **`composes` porta la classe con sé**: i bottoni del finale compongono
    `.contact` dell'HUD, quindi una regola su `.contact` vale anche per loro.
    Per toccare solo l'header: `.header .contact`.
15. **`locator.screenshot()` di un elemento più alto della finestra esce
    nero** in headless: per le schermate usa `page.screenshot()`.
11. **I sorgenti vanno in `scripts/`, non nello scratchpad**: da fuori dal
    progetto gli import bare (`three`, `@gltf-transform/core`) non risolvono.
12. **`node_modules` può mancare** (il 2026-10-08 non c'era, e `npx tsc`
    risponde "This is not the tsc command you are looking for"): `npm ci`,
    una volta per cartella e mai da due sessioni insieme.

## Cosa resta

I task dal 8.1 al 8.28 sono fatti. Quello che manca non è codice da scrivere
a occhi chiusi: sono numeri da guardare in movimento su dispositivi veri e
decisioni del proprietario o del birrificio. L'elenco completo, con la
checklist 9 spuntata voce per voce, è in fondo a `docs/AUDIT.md`.

## Cosa resta non verificato a occhio

Dal 8.28 su questa macchina si **vede**: `npm run qa` fa le schermate con
Chromium headless sulla GPU integrata. Le manopole che questo file elencava
come "primi numeri da ritoccare guardando", guardate il 2026-10-08:

- `CAROUSEL.radius`: **cambiato**, da 6 a un raggio per formato
  (`ringRadius`: 10 desktop, 6 tablet verticale, 3 telefono). Con 6 a
  1440×900 l'anello era un mucchio al centro.
- `PROPS.faro.y` (3,9): il disco del faro è tagliato dal bordo alto come
  deve. Lasciato.
- `SPOT.gain` (10): nel primo piano il tappo è il punto più luminoso e il
  corpo è in penombra; nell'hero la protagonista è illuminata dal faro.
  Lasciato.
- Soglia del bloom (0,85): brillano solo bordo del tappo, disco del faro e
  riflessi del vetro; niente si "brucia". Lasciata.
- Fasce con `?debug=bands`: i quattro rettangoli combaciano con i paragrafi
  della texture e in 3D si accende la fascia giusta.
- Zigrinatura del tappo: si vede, ondulata e senza sfaccettature.
- `HERO_UI.nameAnchor` (0,5): il logotipo sta sul piedistallo, sopra il
  bordo rosso, leggibile. Lasciato.
- Birra dentro (`LIQUID`): in nessuna schermata si intuisce. Dal 2026-11-05
  la `transmission` del vetro è 0 e la birra non viene creata (terzo giro,
  in cima a questo file): alzarla da sola non basta, va schiarito il vetro.

Restano **non verificabili qui**, perché sono movimento o dispositivi: la
fluidità e gli fps su un M1 e su un telefono, l'inerzia del trackpad, il
touch, la lama di luce (in un'immagine ferma non si separa dal resto), le
entrate e uscite dei testi, la scritta del finale lettera per lettera, lo
sfarfallio del faro all'ingresso, la safe area di un iPhone, VoiceOver.

## Resoconto finale (2026-10-08)

**Fatto.** L'esperienza a step della bottiglia è la seconda sezione della
home, fra il hero del sito e "Chi siamo": sette step (hero a carosello, primo
piano col tappo acceso, quattro fasce del retro, finale "ZERO CRISI"),
guidati da rotella, trackpad, touch e tastiera, con testi animati, HUD,
icone, preloader legato al caricamento vero, layout mobile e tablet, moto
ridotto, fallback senza WebGL, DPR adattivo e birra dentro la bottiglia. Il
percorso intero è provato con Playwright a tre formati, e le schermate
stanno in `qa/screens/`. Guardandole, il 8.28 ha corretto quattro difetti
che in Node non si vedevano: lo sfondo che copriva un quarto dello schermo,
i titoli lunghi tagliati dalla maschera, l'header che usciva dallo schermo
del telefono e il raggio dell'anello.

**Non verificabile qui.** Tutto ciò che è movimento o dispositivo (sezione
sopra). I budget di fluidità, draw call e memoria GPU sono stime: le draw call
(≈ 75 contro 60) e la memoria delle render target sono probabilmente sopra il
tetto, e le leve sono pronte ma cambiano la resa.

**Domande aperte per il birrificio** (elenco completo in `docs/AUDIT.md`):

- logo Uranio in SVG, logotipo "CRISI ECONOMICA" ed etichetta in vettoriale;
- conferma dei testi degli step;
- altre birre per il carosello;
- file audio, o via libera a suoni con licenza libera;
- la destinazione di "DOVE TROVARLA" e di "Contatti": `#contatti` non esiste.

**Per il proprietario del repo:** cancellare i GLB morti, gli errori senza
WebGL del hero e di Chi siamo, la colonna di `scrollbar-gutter` su Windows, e
se rientrare nei budget di draw call e memoria GPU a costo di un po' di resa.

# Audit del sito attuale — task 8.1

Fatto prima di toccare qualunque cosa, per rispondere a una domanda sola:
**cosa tengo e cosa sostituisco** quando la home diventa lo scroll 3D a step
descritto in `docs/URANIO_SCROLL_SPEC.md`.

## Stack

| Pezzo | Oggi | Decisione |
| --- | --- | --- |
| Build | Vite 8 + TypeScript 6 `strict`, `type: module` | **Tengo.** La spec (4.1) chiede Vite+TS vanilla ma prevede l'adattamento: il repo è React, non si riscrive da zero. |
| UI | React 19 + `react-router-dom` 7 (route `/`, `/it`, `/en`, `/coming-soon`, `/slash-experiment`) | **Tengo.** Le route servono al deploy statico (vedi `scripts/postbuild.mjs`). |
| 3D | `three` 0.182 via `@react-three/fiber` 9 + `@react-three/drei` 10 | **Tengo.** I moduli `gl/` della spec diventano componenti R3F; l'architettura "stato = funzione pura di `p`" resta identica. |
| Animazione | `framer-motion` 12 (solo `useInView`), il resto scritto a mano | **Aggiungo `gsap`.** Serve per il tween di `p`, `CustomEase` e `SplitText` (task 8.6 e 8.18). Framer resta dov'è. |
| Post-processing | nessuno | **Aggiungo `postprocessing`** (task 8.15). |
| Lint | ESLint 10 + `typescript-eslint`, niente Prettier | **Tengo.** Prettier non serve: lo stile è già coerente. |
| Deploy | `gh-pages` su due repo (prod e prova), `scripts/postbuild.mjs` | **Tengo invariato.** |

Comandi: `npm run dev`, `npm run build` (`tsc -b && vite build && node
scripts/postbuild.mjs`), `npm run deploy` / `deploy:test`.

## Come viene caricato oggi il GLB

`src/components/about/AboutBottle.tsx` fa `useGLTF` su
`public/models/crisi_economica.glb` (320 KB dal task 8.4; prima era il GLB
grezzo da 5,8 MB in `public/3d/`) e passa
la scena a `splitBottleGlb()` + `buildBottleAssembly()`
(`src/components/about/bottleAssembly.ts`), che:

- stacca il nodo `Cylinder_2` (il tappo) congelandone la posa mondo;
- raddrizza il corpo, misura bocca e gonna, ricala il tappo sul collo;
- normalizza l'assieme a 2 unità di altezza, centrato sull'origine;
- espone `capAnchor` + `capAnchorLocal` perché il tappo possa volare via e
  riagganciarsi senza deriva.

**Cosa ne faccio.** La logica di misurazione è buona e verificata headless, ma
è tarata su un assieme alto 2 e su una coreografia di scroll diversa. La spec
(3.2, 6.2) vuole il modello **nelle sue unità native** (altezza 4,18, pivot a
y = 2,09) e le tre mesh nello stesso spazio oggetto, perché gli shader
`reveal`/`focus` ragionano su `vObjPos.y`. Quindi: `bottleAssembly.ts` **resta
dov'è e com'è**, al servizio della sezione "Chi siamo"; la home nuova avrà il
suo `gl/Bottle.ts` con la preparazione della sezione 6.2. Nessuno dei due
tocca l'altro.

## Font e logo

| Asset | Dove | Decisione |
| --- | --- | --- |
| Inter variabile | `@fontsource-variable/inter`, self-hosted, importato in `src/main.tsx` | **Tengo**: è già il `.t-body` della spec (3.6). |
| Beer Money | `src/assets/fonts/beermoney.ttf` + `font/beer_money/` | Da valutare come display. Non è un corsivo pesante tipo Archivo: se non regge, Archivo 900 corsivo self-hosted (task 8.3). |
| Logo Uranio | `src/assets/uranio-mark.png` (raster) e `public/3d/uranio_logo.glb` (3D, usato dall'hero attuale) | **Serve l'SVG**: il PNG non regge i 120 px dell'header HUD (8.16). Aggiunto alle domande aperte. |
| Logotipo "CRISI ECONOMICA" | solo dentro la texture dell'etichetta | Ritaglio dalla texture finché non arriva il vettoriale (8.19). |
| Palette | `src/index.css`: viola `#9137f9` / `#7946fa` / ciano `#3ebedb`, fondo `#0a0a0a` | **Sostituisco** con i token 3.5 (rossi dell'etichetta). Il viola attuale non c'entra con Crisi Economica. |

## Pagine e sezioni, cosa sopravvive

`src/pages/Home.tsx` è la home: `Loader` → `TopBar` → `InvertCursor` →
`<main>` con due sezioni.

| Sezione | Cosa fa | Decisione |
| --- | --- | --- |
| `#hero` (`components/scene/HeroScene.tsx`) | Canvas R3F col logo Uranio 3D a lettere fisiche, starfield, pointer parallax, lock dei gesti su touch | **Tengo intatta** (decisione del proprietario, 2026-10-08): resta la prima sezione, file per file come prima del task 8.21. L'esperienza a step diventa la **seconda** sezione, raggiunta con un passaggio animato (`lib/pageScroll.ts`). |
| `#about` (`components/about/`) | Scrollytelling con bottiglia + tappo pinnato, card, arco, "stonks" | **Tengo intatta** (regola 10.1.10). Diventa il contenuto sotto l'esperienza, raggiunto dal task 8.21. |
| `TopBar` | header con nav, menu hamburger sotto 861 px, switch lingua IT/EN | **Riuso il menu**, rifaccio il guscio come header HUD (8.16): "AUDIO", logo al centro, "⁚⁚ MENU", pillola "CONTATTI". |
| `Loader` | preloader agganciato al progresso reale dei GLB (`lib/assetProgress.ts` + `useProgress` di drei) | **Tengo il meccanismo**, rivesto la grafica (8.22). |
| `InvertCursor`, `ScrollPill`, `HeroLock`, `InteractiveText` | cursore che inverte, pill "scorri", lock dell'hero su touch | **Tengo intatti**, con l'hero (2026-10-08). `HeroLock` ora fa partire il passaggio verso l'esperienza invece dello scroll verso Chi siamo. |
| `/coming-soon`, `/slash-experiment` | pagine a sé | **Non le tocco.** |
| `lib/heroTransition.ts`, `hooks/useHeroLock.ts` | dissolvenza hero→about e blocco scroll su touch | `heroTransition.ts` **tenuto intatto**: le sue dissolvenze fanno da passaggio hero → esperienza. Il blocco su touch di `useHeroLock.ts` lo fa ora `lib/pageScroll.ts`, che possiede lo scroll di tutta la home (hero, passaggio, esperienza, pagina). |

## Correzioni alla spec emerse lavorando (regola 10.1.7)

**3.1 — il tappo non si semplifica, se prima non si salda.** La spec dice
"semplifica a ~8–12k vertici, errore massimo 0,0005" come se bastasse
chiederlo. Non basta: il tappo esce dalla scultura con le normali spezzate su
ogni faccia e con UV che non servono (il suo materiale è rosso metallico senza
texture). `weld()` fonde solo vertici identici bit per bit, quindi non ne
fonde nessuno, e senza saldatura il semplificatore non ha spigoli da
collassare: si pianta a ~50k qualunque errore gli si conceda, da 0,0005 a 0,02.
Togliendo i due attributi inutili prima di saldare si scende a 64k e da lì
l'obiettivo si raggiunge: **10.160 vertici a errore 0,0005**.

Le normali vanno poi rifatte, ma non con `normals()` di gltf-transform: quella
chiama `unweld()` sull'INTERO documento (gonfiando anche vetro ed etichetta, da
121k a 136k vertici e il file da 496 KB a 890 KB) e produce normali piatte, che
su un metallo lucido danno un tappo sfaccettato. In `optimize-glb.mjs` c'è una
`normaliLisce()` di venti righe che lavora sulla sola primitiva del tappo.

**Compromesso accettato:** si perde il taglio netto sulla piega delle
scanalature della corona. La superficie ondula ancora, ma l'ondulazione è
sfumata invece che spigolosa. Misurato: l'inviluppo della silhouette passa da
3,38% a 3,76% di ondulazione su 180 spicchi, tutti coperti — non sta
poligonando. **Non è però un giudizio visivo:** nessuno l'ha ancora guardato in
un browser. La manopola per tornare indietro è `CAP_TARGET_VERTS`.

**5.1.3 — l'accelerazione da sola non distingue un gesto nuovo.** La regola
dice: gesto nuovo se sono passati 160 ms *oppure* se il delta è più di 1,5
volte il precedente e supera 12 px. Preso alla lettera, una spinta sola di
trackpad conta per tre: anche la **salita** iniziale accelera (8, 24, 40 px a
16 ms l'uno) e ogni scatto in salita azzera l'accumulo e fa scattare uno step.

Corretto in `WheelGesture` (`src/core/StepController.ts`): la risalita vale
come gesto nuovo solo se **un gesto ha già fatto scattare uno step** e se la
sua onda è **già sgonfiata sotto metà del picco** — cioè siamo nella coda
dell'inerzia, non nella spinta. La frazione è
`SCROLL.newGestureTailFraction = 0.5` in `src/config/theme.ts`. Verificato in
`npm run verify:core` con tre tracce: spinta di trackpad con coda (1 step),
seconda spinta dentro la coda (2° step), mouse a tacche (1 step per tacca).

**5.1.4 — il lock non può chiedere `tween.isActive()`.** GSAP considera un
tween attivo solo dal primo tick successivo alla creazione: nel frame in cui
parte la transizione `moving` sarebbe falso e un secondo gesto passerebbe.
`Progress` tiene il suo flag.

**7.2 — la colonna "pivot atteso" non torna, le ancore sì.** Risolvendo le
ancore della tabella 7.2 con `solvePivot` (camera FOV 28, 1440×900) i pivot
vengono:

| step | atteso dalla spec | risolto |
| --- | --- | --- |
| 0 | (0, 0,35, 0) | (0, 0,45, 0) |
| 1 | (0,66, −0,41, 0) | (0,67, −0,50, 0) |
| 2 | (0,41, 0,73, 0) | (0,71, 0,84, 0) |
| 3 | (0,41, 0,92, 0) | (0,71, 1,03, 0) |
| 4 | (0,41, 1,20, 0) | (0,71, 1,20, 0) |
| 5 | (0,42, 1,53, 0) | (0,70, 1,54, 0) |
| 6 | (0, −0,15, 0) | (0, −0,15, 0) |

Sulle y lo scarto è ≤ 0,11; sulle x degli step 2–5 è 0,30 fisso, e viene dal
fatto che lì la bottiglia è girata di π: la componente x dell'offset
dell'ancora cambia segno, e la colonna della spec sembra non tenerne conto.

**Non si corregge niente**: la colonna è dichiarata "solo per controllo" e
sono le **ancore** la fonte di verità (spec 7.1: "non scrivere a mano la
posizione della bottiglia"). Quello che si verifica in
`npm run verify:core` non è il numero ma la proprietà, ed è più forte:
riproiettando in camera il punto ancorato, per **ogni** keyframe e a 1440×900,
2560×1080 e 390×844, cade entro 1e-3 dal punto di schermo dichiarato. È la
composizione a essere giusta, su ogni formato.

**6.2 — il bake delle trasformazioni su un GLB quantizzato distrugge la
mesh.** La spec dice `geometry.applyMatrix4(mesh.matrixWorld)` e poi
trasformazione azzerata. Su questo file non si può fare così: il GLB
ottimizzato usa `KHR_mesh_quantization` oltre a meshopt, quindi le posizioni
arrivano come `Int16` **normalizzati e interlacciati**, con la scala vera nel
nodo (il vetro ha geometria in ±1 e scala 2,068). `applyMatrix4` scrive
coordinate in virgola mobile dentro un buffer di interi: vengono troncate, e
la bottiglia esce **alta 1,92 invece di 4,18** senza che niente segnali un
errore.

In `src/gl/prepareBottle.ts` gli attributi si ricostruiscono in `Float32`
prima del bake (`getComponent` denormalizza e legge anche gli interlacciati).
Verificato in `npm run verify:glb`: dopo la preparazione le tre mesh stanno
nello stesso spazio oggetto e cadono sulle misure di `config/bottle.ts` —
vetro 0,0037→4,1388, tappo 4,0475→4,1807, etichetta 0,4550→1,7326.

Nella stessa funzione, **non** si ricalcolano le normali: `applyMatrix4` le
trasforma con la matrice normale (corretto anche per la scala non uniforme del
tappo) e three le normalizza nel vertex shader, mentre
`computeVertexNormals()` butterebbe via le normali lisce costruite a mano dal
task 8.4 per la zigrinatura della corona.

**La geometria originale non si tocca.** `useGLTF` tiene una cache e lo stesso
GLB lo carica la sezione "Chi siamo" (regola 10.1.10): `prepareBottle` clona
tutto ciò che modifica, e `verify:glb` verifica che dopo la preparazione il
bbox della geometria sorgente sia identico.

**6.5 — `pow(x, 2.0)` con base negativa è indefinito in GLSL.** Lo snippet
della lama di luce nella spec scrive
`exp(-pow((normal.x - uSweep) / uSweepWidth, 2.0))`. In GLSL ES `pow` è
definito solo per base ≥ 0, e qui la base è negativa su mezza bottiglia: a
seconda del driver viene 0, NaN o una banda nera. Scritto come prodotto
(`d * d`) in `src/gl/materials/patchBottle.ts`.

Nello stesso file, ogni sostituzione nello shader di three passa da un
controllo che **fallisce a voce alta** se il marcatore non c'è
(`#include <common>`, `<begin_vertex>`, `<dithering_fragment>`): sono l'unico
appiglio della patch e le API di three cambiano spesso (regola 10.1.5). Senza
il controllo, un aggiornamento che li rinomina lascerebbe la bottiglia
illuminata per intero senza un errore. `npm run verify:core` verifica che i
tre marcatori esistano ancora negli shader `physical` e `standard` della
versione installata, che la patch si applichi, che gli uniform siano condivisi
e che il bagliore rosso finisca solo sull'etichetta.

### Dai task 8.19–8.28 (consolidato dal 8.28)

Le note complete stanno nella sezione **Esito** di ogni brief in
`docs/tasks/`; qui le correzioni alla spec, una riga di perché ciascuna.

**6.10 — la birra non è "raggio × 0,93" (8.26).** Il vetro ha due pareti:
sul corpo l'esterna è a 0,6495 e l'interna a 0,594, nel collo 0,2835 contro
0,2466. Il raggio massimo × 0,93 forerebbe la parete interna di 0,01–0,02.
`profiloBirra()` in `prepareBottle.ts` misura la parete più vicina all'asse e
se ne stacca di `LIQUID.gap` (0,008). `verify:glb` lo controlla sparando
raggi contro vetro e birra, senza riusare la misura.

**7.6 — la scritta del finale non sta a 390 px (8.20, 8.23).**
`clamp(120px, 22vw, 360px)` a 390 dà 120 px e "CRISI" in corsivo 900 esce
dallo schermo. Nel layout mobile è `min(22vw, 360px)`.

**7.2 — il raggio del carosello dipende dal formato (8.28).** Con 6 a
1440×900 le estreme cadevano a 0,84 della larghezza: l'anello era un mucchio
al centro, non "sette bottiglie, le estreme tagliate dai bordi". Ora
`ringRadius(vp)` in `config/beers.ts`: 10 a desktop, 6 sul tablet verticale,
3 sul telefono (dove la 7.3 vuole cinque bottiglie: con 6 se ne vedeva una e
mezza). `verify:core` conta i centri proiettati a 1440×900, 1024×768,
768×1024 e 390×844.

**Titoli degli step tagliati a desktop (8.28).** Il corpo `t-display`
(`clamp(40px, 4.6vw, 72px)`) cresce fino a 1565 px di finestra, il blocco di
testo si ferma a 520 px già da 1238: "LEGGEREZZA" (8,51 volte il corpo,
misurata in Chromium) veniva 564 px contro 506 e la maschera delle righe la
tagliava, come "TRASFORMA". Il titolo ora segue la larghezza del blocco
(`StepText.module.css`). Il blocco non si può allargare: la fascia accesa
comincia 33 px più a destra.

**Lo sfondo copriva un quarto dello schermo (8.28).** Il canvas `#bg` era
posizionato con `inset: 0`, che su un elemento sostituito non stira niente:
restava grande quanto il suo buffer. Con lo sfondo a DPR × 0,5 (8.27) il
buffer è mezzo schermo per lato. Visto solo negli screenshot: `width/height:
100%` in `Experience.module.css`.

**L'header HUD usciva dallo schermo sui telefoni (8.28).** Misurato a 390:
audio 122 + logo 88 + menu 72 + pillola 92 = 449 px con padding e gap.
Sotto i 460 px la pillola "CONTATTI" dell'header sparisce (la voce resta nel
menu) e il gap scende a 8 px. Attenzione: i bottoni del finale ereditano la
pillola con `composes`, la regola vale solo dentro `.header`.

**Il bake della maschera del logotipo è in negativo (8.19).**
`sharp().dilate()` nella 0.35.5 allarga il nero, non il bianco: la maschera
si costruisce a lettere nere e si inverte dopo. Con la maschera dritta il
risultato era tutto trasparente, senza errori.

## Scostamenti dalla spec, decisi qui (regola 10.1.7)

1. **Niente branch `feat/scroll-3d`.** Il task 8.1 lo chiede, ma `CLAUDE.md`
   dice esplicitamente di restare su `main` ed è l'autorizzazione in piedi del
   proprietario del repo. Si lavora su `main`, un task = un commit, come già
   si fa qui. Se serve il branch, si fa e si cambia la riga in `CLAUDE.md`.
2. **Il GLB è copiato in `assets-src/`, non spostato.** Spostarlo adesso
   romperebbe la sezione "Chi siamo", che lo carica da `public/3d/`, e il task
   dice "nessun file del sito è cambiato". La copia in `public/3d/` sparisce
   al task 8.4, quando `scripts/optimize-glb.mjs` produce
   `public/models/crisi_economica.glb` e la sezione About punterà lì.
3. **Stack React, non vanilla.** Previsto dalla 4.1. I moduli `core/` della
   spec (`Ticker`, `Viewport`, `StepController`, `Progress`, `StateMapper`)
   restano classi TypeScript pure, fuori da React: così sono testabili in Node
   come già si fa con `bottleAssembly.ts`. Solo i moduli `gl/` e `ui/`
   diventano componenti.

4. **La home non è più solo l'esperienza (2026-10-08, decisione del
   proprietario).** Il vecchio hero (logo Uranio 3D, `components/scene/`) è
   tornato prima sezione, l'esperienza è la seconda (`#esperienza`), poi Chi
   siamo. Un gesto verso il basso nel hero fa un passaggio animato; dallo step
   0 un gesto verso l'alto torna al hero. Lo scroll lo possiede
   `lib/pageScroll.ts` (`b8673b9`). Il 8.21 aveva cancellato quei file: sono
   tornati com'erano prima di `b4e2d63`.
5. **Icone degli step sotto il testo su mobile, non sopra (8.23).** Metterle
   sopra vuol dire conoscere l'altezza del testo, che cambia da step a step e
   vive in un altro strato.
6. **Layout mobile = `width < 768` oppure `aspect <= 1` (8.23).** Il tablet
   verticale ha la composizione del telefono (`KEYFRAMES_TABLET`, camera ×1,1)
   ma DPR e nove bottiglie del desktop.
7. **Moto ridotto sulla corsa, non sul segmento (8.24).** `reducedPose`
   ragiona su `from → to`: un salto con le icone da 1 a 4 non fa lampeggiare
   2 e 3.
8. **Ordine di tabulazione: le icone degli step vengono prima dei controlli
   dell'hero e del testo (8.24),** perché stanno nello strato HUD dopo
   l'header.
9. **Finale nascosto con `inert` (8.20),** al posto di `tabIndex={-1}` più
   `pointer-events: none`.
10. **Il piedistallo sale insieme alla protagonista nell'ingresso (8.22):**
    altrimenti lei lo attraverserebbe salendo da sotto. L'ingresso parte
    all'arrivo dal hero, non alla fine del Loader.
11. **Lo stappo suona a ogni `step:leave` da 0 (8.25),** non solo 0 → 1: le
    icone saltano anche da 0 a 3.
12. **PostFX anche su mobile, montato dopo il primo frame (8.27):** senza
    bloom, ma è il composer a fare l'antialias.
13. **Su telefono la pillola "CONTATTI" dell'header non c'è (8.28):** non ci
    sta. La voce resta nel menu.

## Pesi morti trovati

- `public/3d/ginger_beer_bottle.glb` (8,2 MB) e
  `public/3d/old_antic_beer_bottle_cap.glb` (5,9 MB): non più referenziati da
  quando la sezione About usa il GLB di Crisi Economica. Finiscono comunque in
  `dist/`. Da cancellare, serve il via libera.
- `public/3d/Crisi_Economica_etichettata.glb`: **cancellato al task 8.4**, lo
  sostituisce `public/models/crisi_economica.glb` (320 KB). Il sorgente resta
  in `assets-src/`, da cui lo script di ottimizzazione rigenera tutto.
- `public/3d/Japanese_Sign_10.glb`, `KX418_003C0_V7.glb`,
  `PolygonalMindLogo_Art.glb` e `public/3d/optimized/`: nessun riferimento nel
  codice. Stesso discorso.
- `public/ordine-*.pdf`: documenti personali in `public/`. `postbuild.mjs` li
  toglie dalla build, ma restano nel repo e nella sua storia.

## Domande aperte (dalla 10.2, più quelle nate qui)

- [ ] Logo Uranio in SVG (il PNG attuale non basta per l'header).
- [ ] Etichetta vettoriale per la texture a 4096 px.
- [ ] Logotipo "CRISI ECONOMICA" vettoriale.
- [ ] Conferma dei testi della tabella 3.7.
- [ ] Altre birre per il carosello.
- [ ] Audio: file del birrificio o via libera a suoni con licenza libera.
- [ ] Link Instagram e destinazione di "DOVE TROVARLA".
- [ ] Via libera a cancellare i GLB morti elencati sopra.
- [ ] Branch sì o no (punto 1 degli scostamenti).
- [ ] **`#contatti` non esiste** (8.20): "DOVE TROVARLA", la pillola
      "CONTATTI" dell'HUD e "Contatti" del menu (`components/nav.tsx`)
      puntano a un'ancora che nessun elemento ha. Serve la destinazione vera.

Domande per il proprietario del repo, non per il birrificio:

- [ ] **Senza WebGL il hero e Chi siamo lanciano errori** (8.28): l'esperienza
      monta il suo fallback, ma i canvas di `#hero` e `#about` lanciano
      "Error creating WebGL context" non gestiti (quattro a pagina, visti con
      Playwright). La pagina resta leggibile; il hero resta un fondo nero col
      solo testo. Sono file che il 8.28 non tocca (regola 10.1.10 e accordo
      col cambio della home).
- [ ] **`scrollbar-gutter: stable`** (`index.css`) evita il salto di layout
      quando lo scroll si blocca, ma su Windows con barre classiche lascia una
      colonna nera di ~15 px a destra dell'esperienza (si vede negli
      screenshot QA). Su Mac e telefono le barre sono sovrapposte e non si
      vede.
- [ ] **Draw call e memoria GPU** (8.27, stime): ≈ 75 draw call nell'hero
      desktop contro il tetto di 60 (la `transmission` del vetro ridisegna gli
      opachi), e le render target a DPR 1,75 oltre i 64 MB. Leve pronte ma non
      applicate perché cambiano la resa: `transmissionResolutionScale` 0,5,
      birra solo sulla protagonista, carosello in `InstancedMesh`.
- [ ] **Logotipo a 546 px** (8.19): basta fino a ~310 px CSS a DPR 1,75; a
      1440 px è largo 345 px e si vede un filo morbido sui retina. Col
      vettoriale (domanda sopra) il problema sparisce.

## Budget e checklist 9 — QA finale (task 8.28)

Il 2026-10-08 su questa macchina è arrivato un browser: Chromium headless di
Playwright, con la GPU integrata AMD Radeon via ANGLE D3D11 (~35–41 fps a
1440×900; swiftshader ne fa ~3). `npm run qa` percorre hero → 0 → 6 → 0 →
hero con la tastiera a 1440×900, 390×844 e 768×1024 e salva le schermate in
`qa/screens/`; `qa/accessibilita.spec.ts` prova moto ridotto e fallback senza
WebGL. **Le schermate sono state guardate una per una.** Resta vero che
nessuno ha visto il movimento su un dispositivo reale: una schermata ferma
non dice niente di fluidità, inerzia e tempi.

`[x]` = visto o misurato; il resto dice perché no.

### 9.1 Budget

| Voce | Limite | Stato |
| --- | --- | --- |
| GLB ottimizzato | < 1,2 MB | **320 KB**, misurato (8.4) |
| JS del primo frame (gzip) | < 350 KB | **349,4 KB**, misurato (`214be96`): il primo frame ora è il hero del sito, l'esperienza si scarica dopo. Margine 0,6 KB |
| Primo frame composto (4G) | < 3 s | non misurato: niente rete strozzata qui |
| 60 fps desktop (M1, Chrome) | | non misurato sul dispositivo. Indicativo: 35–41 fps in headless su GPU integrata AMD, a schermo pieno 1440×900 |
| ≥ 45 fps mobile | | non misurato: niente telefono |
| Draw call nell'hero | < 60 | **≈ 75, stimato per conteggio, sopra il tetto** (8.27): vedi domande aperte |
| Memoria GPU texture | < 64 MB | texture ≈ 15 MB, stimate; con le render target a DPR 1,75 si è oltre (8.27) |

### 9.2 Checklist

- [ ] **Un gesto = uno step.** Tastiera vista: a ogni freccia l'hash arriva
      allo step successivo, 0 → 6 → 0, ai tre formati. Rotella, trackpad con
      inerzia e touch: provati solo come tracce in `verify:core`, mai con un
      dito o un trackpad veri.
- [ ] **Durate, morbidezza, riavvolgimento identico.** Le durate sono quelle
      della tabella 5.2 in `verify:core`, non a occhio. Il riavvolgimento sì,
      misurato: andata e ritorno dello stesso step differiscono in media di
      5–9 livelli su 255 contro i 16–18 fra due step vicini, e lo scarto è la
      grana animata e la vita a riposo (il hero, senza grana, dà 0,1).
      Guardate affiancate, le composizioni coincidono. La morbidezza di
      partenza e arrivo non si vede in una schermata.
- [ ] **Inversione a metà corsa e salti con le icone.** Non provati in
      browser; solo la logica, in `verify:core`.
- [ ] **Hero.** [x] sette bottiglie a 1440×900 con le estreme tagliate dai
      bordi (dopo la correzione del raggio, sopra), inclinate in modo vario,
      protagonista sotto il faro e sul piedistallo. Fluttuazione, drag e frecce:
      non visti (servono movimento e mouse).
- [x] **Primo piano.** La cima cade a (0,47; 0,14) come da ancora, il bordo del
      tappo è il punto più luminoso, collo e tappo pieni, corpo in penombra,
      fronte dell'etichetta leggibile in basso. La zigrinatura della corona si
      vede: ondulata, senza sfaccettature.
- [x] **Retro.** Ogni step accende la sua fascia e il resto dell'etichetta resta
      in penombra (ritaglio a piena risoluzione dello step 2, e
      `?debug=bands` con i quattro rettangoli sopra la texture: combaciano). La
      fascia accesa sta sempre a destra del testo, a ~0,42–0,46 dell'altezza
      su desktop e ~0,30–0,33 su mobile; la bottiglia sale e si raddrizza da 2
      a 5.
- [ ] **Lama di luce.** Non conclusivo: nella schermata a metà del passaggio
      1 → 2 l'etichetta è più accesa che a riposo, ma in un'immagine ferma la
      lama non si separa dalla luce dell'etichetta che ruota. Va guardata in
      movimento.
- [ ] **Finale.** [x] nebbia rossa viva, "ZERO / CRISI" dietro la bottiglia,
      note e due bottoni sotto, a tutti e tre i formati. L'entrata lettera per
      lettera non si vede in una schermata. "DOVE TROVARLA" porta a
      `#contatti`, che non esiste (domanda aperta).
- [ ] **Testi.** [x] mai due blocchi visibili insieme: a metà della
      transizione 1 → 2 c'è solo il tag del testo nuovo che entra. [x] Il tag
      barrato è disegnato. L'uscita a righe e l'entrata con sfocato sono
      movimento: non viste.
- [x] **HUD completo.** Header, barra di progresso che cresce step per step,
      icona attiva evidenziata, angolari, lettere di sfondo; nel finale l'HUD
      si fa da parte.
- [ ] **Niente z-fighting, flash, salti, pop-in.** Nessuno z-fighting in
      nessuna schermata. Flash, salti di layout e pop-in si vedono solo in
      movimento: non verificati. Unico salto noto: la colonna di
      `scrollbar-gutter` su Windows (domanda aperta).
- [x] **Mobile 390×844 e tablet 768×1024.** Composizioni della 7.3 (testo in
      basso sulla sfumatura, bottiglia sopra, icone in riga), testi mai
      coperti, cinque bottiglie nell'hero del telefono. Corretti l'header che
      usciva dallo schermo e il raggio dell'anello. Safe area di un iPhone
      vero: non vista.
- [ ] **Reduced motion, tastiera, screen reader, fallback.** [x] Moto ridotto:
      gli step arrivano lo stesso, composizione giusta (Playwright con
      `reducedMotion: reduce`). [x] Tastiera: il percorso intero. [x] Fallback
      senza WebGL: l'esperienza mostra logotipo, step in colonna con le
      immagini delle fasce e i bottoni, e scorre nativa; ma il hero e Chi
      siamo lanciano errori (domanda aperta). Screen reader (VoiceOver, NVDA):
      non provato.
- [x] **Niente di Ciao Energy.** Nessun file né testo che lo nomini fuori da
      `docs/` (dove è citato come riferimento nella spec).
- [x] **README aggiornato e schermate QA in `qa/screens/`.**

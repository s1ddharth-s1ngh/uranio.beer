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
| `#hero` (`components/scene/HeroScene.tsx`) | Canvas R3F col logo Uranio 3D a lettere fisiche, starfield, pointer parallax, lock dei gesti su touch | **Sostituita** dall'esperienza a step (hero a carosello di bottiglie). È questo il pezzo che la spec rimpiazza. |
| `#about` (`components/about/`) | Scrollytelling con bottiglia + tappo pinnato, card, arco, "stonks" | **Tengo intatta** (regola 10.1.10). Diventa il contenuto sotto l'esperienza, raggiunto dal task 8.21. |
| `TopBar` | header con nav, menu hamburger sotto 861 px, switch lingua IT/EN | **Riuso il menu**, rifaccio il guscio come header HUD (8.16): "AUDIO", logo al centro, "⁚⁚ MENU", pillola "CONTATTI". |
| `Loader` | preloader agganciato al progresso reale dei GLB (`lib/assetProgress.ts` + `useProgress` di drei) | **Tengo il meccanismo**, rivesto la grafica (8.22). |
| `InvertCursor`, `ScrollPill`, `HeroLock`, `InteractiveText` | cursore che inverte, pill "scorri", lock dell'hero su touch | `ScrollPill` e `HeroLock` muoiono con l'hero attuale (li sostituiscono lo "SCORRI PER SCOPRIRE" e il motore a step). `InvertCursor` e `InteractiveText` da rivalutare in fase D. |
| `/coming-soon`, `/slash-experiment` | pagine a sé | **Non le tocco.** |
| `lib/heroTransition.ts`, `hooks/useHeroLock.ts` | dissolvenza hero→about e blocco scroll su touch | **Riscritti** dal task 8.21: la logica di passaggio cambia del tutto. |

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

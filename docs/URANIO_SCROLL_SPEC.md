# Mega Prompt Claude Code — Uranio Scroll 3D (ispirato a Ciao Energy)

Oct 7, 2026 · @Samar - Growe

## 1. Ruolo, contesto e obiettivo

Copia tutto questo documento come primo messaggio in Claude Code (oppure salvalo nel repo come `docs/URANIO_SCROLL_SPEC.md` e di' a Claude Code di leggerlo). Da qui in poi il testo parla direttamente a Claude Code.

**Ruolo.** Sei un senior creative developer specializzato in WebGL (Three.js), animazione (GSAP) e siti prodotto premium. Lavori sul sito di **Uranio**, birrificio artigianale italiano (IG @uranio.beer). Il prodotto protagonista è la birra **Crisi Economica**, Ordinary Bitter 4,2% vol, bottiglia di vetro scuro 33 cl con tappo a corona rosso.

**Obiettivo.** Trasforma la homepage di Uranio in un'esperienza di scroll 3D che riprende con la massima fedeltà possibile la regia del sito di riferimento Ciao Energy: stesse dinamiche di camera, stesso ritmo, stesso uso della luce, stesso modo di far comparire i testi mentre il prodotto ruota. Il contenuto invece è tutto di Uranio: bottiglia, etichetta, colori, testi.

**Cosa riprendere dal riferimento (la regia, non il marchio):**

- Apertura con un carosello di tante bottiglie sospese e inclinate, illuminate in modo drammatico su fondo scuro, con nome del prodotto, barra colorata e invito a scrollare.
- Scroll "a scalini": ogni gesto di scroll, piccolo o grande, non muove la pagina in modo libero. Fa partire un'animazione automatica e morbida che porta la scena allo step successivo, come salire di livello. Il ritmo è lento e cinematografico.
- Dopo l'apertura la camera si avvicina alla bottiglia protagonista, che resta inclinata in diagonale. Prima la luce colpisce solo il tappo (nel nostro caso il collo di vetro e il tappo a corona), poi la bottiglia ruota e mostra man mano le diverse parti dell'etichetta, mentre a sinistra compaiono titolo e testo dello step.
- Interfaccia sottile da "HUD": logo al centro in alto, barra di progresso in alto, angolari agli angoli del frame, lettere spaziate sullo sfondo, icone circolari a destra che indicano lo step attivo.

**Cosa NON copiare:** logo, testi, font proprietari, immagini e modelli 3D di Ciao Energy. Ogni asset deve essere di Uranio o creato da zero.

**Livello di qualità atteso:** sito da agenzia premiata. 60 fps su un portatile medio, nessun salto di layout, nessun flash bianco al caricamento, transizioni sempre interrompibili e mai a scatti.

**Prima di scrivere codice:** esplora il repository esistente (stack, build, struttura, come viene caricato oggi `Crisi_Economica_etichettata.glb`). Se il sito attuale usa già Three.js, riusa ciò che funziona. Se il repo è vuoto o non adatto, usa lo stack della sezione 4. In ogni caso lavora per mini task, un commit per task, nell'ordine della sezione 8.

## 2. Analisi del video di riferimento (Ciao Energy)

Il video di riferimento (52,7 s, 1292×908, 30 fps) mostra 7 stati: 1 hero a carosello, 1 primo piano del prodotto, 4 step sul retro della lattina, 1 finale. Ogni stato si raggiunge con **un solo gesto** di scroll; la transizione dura 0,8–1,2 s e poi la scena resta ferma, viva solo per micro-movimenti. Tornando indietro con lo scroll, ogni transizione si riavvolge identica al contrario. Sito: [ciaoenergy.com](https://www.ciaoenergy.com/) (se hai accesso web aprilo per confronto, ma la fonte di verità è questa sezione: il WebGL non si legge con un fetch).

### 2.1 Gli stati, uno per uno

| Stato | Camera e prodotto | Luce e sfondo | Testi e UI |
| --- | --- | --- | --- |
| 0 · Hero (carosello) | Camera frontale, distanza media. 7–9 lattine sospese su un arco attorno all'asse verticale, ognuna inclinata in modo diverso (10–25°). Quella centrale è davanti, più grande, inclinata con la cima verso sinistra (\~17°) e leggermente verso la camera (si vede il coperchio). Le laterali sono più lontane e scure. | Fondo "studio": nero in alto, pavimento grigio chiaro sfumato al centro in basso. In alto, dietro il logo, un faro circolare metallico che illumina dall'alto la lattina centrale. In basso un piedistallo scuro con bagliore colorato (rosa/ciano). Le laterali hanno solo rim light colorate. | Nome prodotto grande al centro sul piedistallo. Frecce a puntini ai lati della lattina centrale. Slider orizzontale a gradiente con pallino (selettore gusto). "Scroller pour découvrir" in basso. Cursore a manina "grab": il carosello si trascina. |
| 1 · Primo piano | La lattina centrale diventa enorme: la cima è al 15–20% dall'alto, il fondo esce dal frame in basso. È a destra del centro, inclinata \~26° con la cima a sinistra, si vede il coperchio. Davanti è il logo. | Fondo viola profondo con alone radiale più chiaro in basso al centro. **Il punto più luminoso è la cima**: riflesso bianco forte sul bordo del coperchio, il corpo resta in penombra con un riflesso lungo e morbido. | A sinistra: titolo display corsivo pesante su 2 righe + paragrafo di 2 righe. A destra: colonna di 4 icone circolari (uno per step). Barra di progresso in alto con testa luminosa. Lettere spaziate a bassa opacità sullo sfondo che compongono il nome del gusto. |
| 2 · Retro, paragrafo 1 | La lattina ruota di \~180° sul proprio asse e mostra il retro. Meno inclinata (\~15°), un po' più piccola. | Tutto il corpo diventa quasi nero. **Solo una fascia orizzontale dell'etichetta è accesa** (il paragrafo che si sta raccontando), con testo che brilla nel colore accento. | Tag con quadratino "×" + etichetta bianca con testo barrato (la riga barrata si disegna da sinistra a destra dopo l'entrata). Titolo + paragrafo. Prima icona a destra attiva (cerchio pieno con alone). |
| 3, 4, 5 · Retro, paragrafi 2–4 | La lattina sale lungo il proprio asse di circa un paragrafo per step, così il paragrafo nuovo arriva all'altezza della fascia accesa. L'inclinazione cala a ogni step (15° → 11° → 8° → 6°). | La fascia accesa segue il paragrafo attivo; il resto resta buio. | Stesso layout, testi nuovi, icona successiva attiva. |
| 6 · Finale | La lattina ruota tornando sul fronte, scende al centro, quasi verticale, intera nel frame (circa 60% dell'altezza). | Fondo che diventa una nebbia luminosa lavanda con sbuffi più chiari, animata lentamente. La lattina è illuminata in modo pieno e leggibile. | Scritta gigante su 2 righe dietro la lattina, bianca semitrasparente (\~35%), che compare lettera per lettera. Icone e testi a sinistra spariscono. |

### 2.2 Le transizioni, misurate sul video

| Transizione | Durata misurata | Cosa succede, in ordine |
| --- | --- | --- |
| Hero → Primo piano | \~1,0 s | 0–0,3 s: le lattine laterali scappano verso l'esterno (sinistra a sinistra, destra a destra) e si scuriscono; il faro sale fuori dal frame, il piedistallo scende. 0,3–0,5 s: lo sfondo sfuma dal grigio studio al viola; il nome in basso svanisce mentre titolo e paragrafo a sinistra entrano. 0,4–1,0 s: la lattina centrale si ingrandisce, va a destra, aumenta l'inclinazione; icone a destra entrano in sequenza; parte la barra di progresso. |
| Primo piano → Retro 1 | \~0,85 s | Le righe del testo vecchio escono verso l'alto tagliate da una maschera (prima il titolo, poi le righe del paragrafo, sfalsate). La lattina ruota \~180° e si raddrizza un po'; il riflesso bianco scorre sulla superficie durante la rotazione. Il corpo si spegne e si accende la fascia. A metà della rotazione entra il testo nuovo: tag, titolo, paragrafo, ogni riga sale da sotto la maschera con un leggero sfocato. Dopo \~0,4 s si disegna la riga barrata del tag. |
| Retro N → Retro N+1 | 0,4–0,6 s di movimento 3D, \~1 s totale con i testi | La lattina sale e si raddrizza un po'. Testo vecchio fuori (0,25–0,3 s), testo nuovo dentro (\~0,5 s). La fascia luminosa scivola sul paragrafo nuovo. |
| Retro 4 → Finale | \~1,0–1,2 s | Testi e icone fuori. La lattina ruota verso il fronte mentre scende al centro e rimpicciolisce. Lo sfondo si schiarisce in nebbia. Le lettere della scritta gigante compaiono una alla volta. |
| Qualsiasi → indietro | uguale all'andata | Stessa animazione al contrario. Cliccando un'icona si salta direttamente allo step (passando dagli stati intermedi, senza fermarsi). |

### 2.3 Dettagli che fanno la differenza

- **Easing.** Tutto parte e arriva morbido (curva tipo `power3.inOut` / `expo.inOut`). Niente movimenti lineari. La scena non è mai completamente ferma: lattine che fluttuano di pochi pixel, nebbia che respira.
- **Ritmo "a livelli".** Tra un gesto e l'altro c'è una pausa: l'inerzia dello scroll del trackpad non fa saltare due step.
- **Riflesso che viaggia.** Durante le rotazioni una lama di luce bianca attraversa la superficie (è una luce rettangolare riflessa dall'ambiente, non un faretto puntiforme).
- **HUD.** Angolari a "L" ai quattro angoli del frame (inset \~36 px), piccoli angolari attorno al blocco di testo, trattini sottili sui bordi laterali, lettere singole a bassa opacità disposte su una griglia larga.
- **Header.** A sinistra "ON" con 4 barrette animate tipo equalizzatore (audio). Al centro logo bianco. A destra "⁚⁚ MENU" e un bottone pillola bianco "CONTACT" con alone bianco diffuso.
- **Barra di progresso** in alto a tutta larghezza: linea grigia sottile, riempimento bianco con testa luminosa sfumata; avanza di una frazione a ogni step.
- **Icone step** a destra: cerchi da \~60 px con bordo sottile e icona al centro, collegati da puntini; quella attiva ha fondo chiaro e alone.
- **Testi.** Titoli: display corsivo molto pesante, maiuscolo, interlinea stretta (\~0,9). Paragrafi: grotesk regolare \~18 px, bianco, 3–4 righe da \~45 caratteri.

## 3. Asset Uranio: bottiglia, etichetta, colori, testi

L'unico modello è `Crisi_Economica_etichettata.glb` (5,8 MB, export Blender glTF 2.0). Ha 3 mesh: vetro, tappo, etichetta avvolta. I numeri sotto sono misurati sul file: usali, ma verificali con un helper di debug prima di costruirci sopra.

### 3.1 Struttura del GLB

| Nodo | Mesh | Vertici | Materiale | Note |
| --- | --- | --- | --- | --- |
| `Object_4` (dentro un nodo dal nome corrotto) | vetro | 4.989 | `.001`: base quasi nera (0.022, 0.026, 0.032), roughness 0, **metalness non indicata → default glTF = 1**, doubleSided | Col default metallico il vetro diventa uno specchio nero: è la causa del look piatto e "a bande" del sito attuale. Va sostituito. |
| `Cylinder_2` → `Object_4.001` | tappo a corona | **107.702** | `Material.002`: rosso (0.387, 0, 0.002), metalness 0.7, roughness 0.47, clearcoat 1 | Da solo pesa \~5 MB dei 5,8 MB. Trasformazioni annidate assurde (scale 0.03 / 0.0036 × 11.56): fai il bake delle trasformazioni e semplifica a \~8–12k vertici. |
| `Etichetta CRISI ECONOMICA` | etichetta avvolta ("fronte e ingredienti retro") | 8.721 | `Etichetta originale trasparente`: alpha BLEND, texture PNG 2008×827 incorporata (identica a `CRISI_ECONOMICA_etichetta.png`) | Raggio 0,651, ma il vetro nella stessa zona ha raggio 0,656: **l'etichetta sta dentro il vetro** di 0,005 → z-fighting o etichetta nascosta. Fix: scala X/Z dell'etichetta ×1,012 (raggio \~0,659) + `polygonOffset`. |

### 3.2 Geometria (unità del modello, asse Y verso l'alto)

- Altezza totale 0 → 4,18 (circa 21–23 cm reali). Centro geometrico a y ≈ 2,09: avvolgi il modello in un `Group` pivot con `inner.position.y = -2.09`, così ogni rotazione avviene attorno al centro.
- Corpo cilindrico r ≈ 0,65 da y 0,25 a 1,93. Spalla da 1,93 a 2,55. Collo r 0,31 → 0,28 da 2,55 a 3,76. Anello del collo r 0,335 a 3,81–3,87. Bocca r 0,296 a 4,06–4,11. Tappo da 4,05 a 4,18, r ≈ 0,34.
- Etichetta da y 0,455 (basso) a 1,733 (alto).

### 3.3 Come è mappata l'etichetta (serve per sapere cosa guarda la camera)

- **v → altezza:** `y = 1.733 − v × 1.278` (v = 0 è il bordo alto della texture).
- **u → angolo** (θ in gradi attorno a Y, 0° = asse +Z cioè verso la camera di default, positivo verso +X). L'etichetta copre \~270° in due strisce: fronte `u ∈ [0, 0.50] → θ ≈ −57 + 270·u`; retro `u ∈ [0.55, 1] → θ ≈ 113 + 271·(u − 0.55)`. Restano due vuoti di vetro nudo (78°–113° e 235°–303°).
- **Fronte** (fulmini + "CRISI ECONOMICA"): centro u ≈ 0,22 → θ ≈ 2° → si vede con `rotation.y = 0`.
- **Retro** (disco nero con le informazioni): centro u ≈ 0,795 → θ ≈ 180° → si vede con `rotation.y = π`.
- Per portare davanti una colonna u qualsiasi: `rotation.y = −θ(u)` (in radianti).

### 3.4 Le fasce del retro (equivalenti ai paragrafi della lattina Ciao)

Sono le zone che si accendono una per volta negli step 2–5. Coordinate in pixel della texture 2008×827, centro orizzontale del disco x ≈ 1595.

| Fascia | Contenuto sull'etichetta | y texture (px) | v centro | y oggetto centro | mezza altezza (oggetto) |
| --- | --- | --- | --- | --- | --- |
| F1 | "ORDINARY BITTER" + ingredienti | 85–200 | 0,172 | 1,513 | 0,089 |
| F2 | "TRASFORMA LA CRISI IN PIACERE" + produttore | 218–312 | 0,320 | 1,324 | 0,073 |
| F3 | 4,2% Vol.alc, 33cl, logo URANIO, pittogrammi | 335–550 | 0,535 | 1,049 | 0,166 |
| F4 | Raccolta differenziata, scadenza, IG @uranio.beer | 565–745 | 0,792 | 0,721 | 0,139 |

### 3.5 Palette

Presa dai pixel dell'etichetta. Mettila in `src/styles/tokens.css` e in `src/config/theme.ts` (stessi valori per CSS e shader).

| Token | Valore | Uso |
| --- | --- | --- |
| `--u-black` | `#050505` | fondo pagina, nessun flash bianco |
| `--u-red` | `#DB4442` | rosso fulmini: accento, fascia accesa, barra, icona attiva |
| `--u-red-mid` | `#A3302A` | sfumature, rim light |
| `--u-red-deep` | `#6B1A12` | ombre colorate |
| `--u-oxblood` | `#3A0D0E` | centro dell'alone negli step (equivalente del viola Ciao) |
| `--u-night` | `#090303` | bordi dell'alone negli step |
| `--u-fog-1` / `--u-fog-2` | `#DB4442` / `#FF8A80` | nebbia del finale |
| `--u-white` | `#F8F8F8` | testi |

### 3.6 Font

Prima controlla quali font usa già il sito Uranio e riusali. Se non ce ne sono di adatti: titoli in **Archivo** (Google Fonts, variabile) a peso 900, larghezza 112–125, corsivo, maiuscolo, interlinea 0,88: è il corrispettivo libero del display corsivo pesante di Ciao. Testi in **Inter** 400/500. La scritta "CRISI ECONOMICA" a pennello non è un font: ritagliala dalla texture (zona fronte, x 20–860) come immagine o, meglio, chiedi il vettoriale. Lo stesso vale per il logo URANIO (zona x 1490–1700, y 335–550).

### 3.7 Testi (bozza, da validare con il birrificio)

Tutti i testi stanno in `src/content/steps.it.json`, mai scritti nel codice. Fatti presi solo dall'etichetta.

| Step | Tag | Titolo | Paragrafo | Icona |
| --- | --- | --- | --- | --- |
| 0 Hero | — | CRISI ECONOMICA | sotto: "ORDINARY BITTER · 4,2%" e "SCORRI PER SCOPRIRE" | — |
| 1 Primo piano | — | CRISI ECONOMICA | Una Ordinary Bitter all'inglese, leggera e da bere a pinte. Per i giorni in cui tutto va storto. | — |
| 2 · F1 | 4 INGREDIENTI | ORDINARY BITTER | Acqua, malto d'orzo, luppolo, lievito. Nient'altro in etichetta. | spiga |
| 3 · F2 | ~~CRISI~~ (barrato) | TRASFORMA LA CRISI IN PIACERE | Prodotta e confezionata per Uranio a Castelletto Stura (CN), in Piemonte. | fulmine |
| 4 · F3 | 4,2% VOL | 33 CL DI LEGGEREZZA | Gradazione bassa, bottiglia da 33 cl: una birra da sessione, da stappare senza pensarci troppo. | goccia |
| 5 · F4 | ~~INDIFFERENZIATA~~ (barrato) | VETRO, METALLO, PLASTICA | Bottiglia in vetro GL72, tappo in metallo C/FE91, etichetta in plastica PP5. Verifica le regole del tuo comune. | riciclo |
| 6 Finale | — | scritta gigante: ZERO / CRISI | riga piccola: "Conservare al freddo e al buio. Contiene deposito naturale." + CTA "@uranio.beer" | — |

Lettere HUD di sfondo: riga alta "C R I S I", riga bassa "E C O N O M I C A".

### 3.8 Sito attuale

Oggi la bottiglia è renderizzata su fondo nero con riflessi piatti a bande e nessuna profondità (screenshot fornito). L'obiettivo di qualità: vetro scuro credibile con riflessi lunghi e morbidi, tappo rosso metallico brillante, etichetta nitida e leggibile.

## 4. Stack tecnico e architettura

Il principio che regge tutto: **lo stato 3D è una funzione pura di un numero continuo `p`** (da 0 a N, uno per step). Lo scroll non muove la pagina: sceglie lo step di destinazione e GSAP anima `p` fin lì. Ogni frame, camera, bottiglie, luci e shader si calcolano da `p`. Così andata, ritorno e salti con le icone funzionano gratis e sono sempre coerenti. I testi HTML invece sono discreti: cambiano solo quando cambia lo step di destinazione.

### 4.1 Stack

| Pezzo | Scelta | Perché |
| --- | --- | --- |
| Build | Vite + TypeScript, vanilla (niente framework) | Il sito è una scena a tutto schermo; un framework aggiunge solo peso. Se il repo esistente è React/Next, usa react-three-fiber + drei e traduci gli stessi moduli in componenti, mantenendo l'architettura a `p`. |
| 3D | `three` (ultima stabile), `GLTFLoader` + `MeshoptDecoder` (+ `KTX2Loader` se usi texture KTX2) | Standard, controllo totale sugli shader. |
| Animazione | `gsap` con `SplitText` e `CustomEase` (dalla 3.13 tutti i plugin sono gratuiti) | Timeline, easing, split dei testi in righe con maschera. |
| Post-processing | `postprocessing` (pmndrs): Bloom selettivo, Vignette, Noise, SMAA | Più leggero di `EffectComposer` standard, effetti fusi in un passaggio. |
| Ottimizzazione asset | `@gltf-transform/cli` | Bake trasformazioni, semplificazione tappo, meshopt, texture WebP/KTX2. |
| Debug | `lil-gui` + `stats-gl`, attivi solo con `?debug` | Regolare keyframe e luci dal vivo e copiarli in config. |

### 4.2 Strati della pagina (dal fondo verso l'alto)

1. `#bg` – canvas WebGL dello sfondo (gradiente studio dell'hero, alone rosso scuro degli step, nebbia del finale). Shader a tutto schermo, economico.
2. `.bigword` – la scritta gigante del finale "ZERO / CRISI" in HTML, dietro la bottiglia.
3. `#gl` – canvas WebGL trasparente con bottiglie, faro, piedistallo, post-processing.
4. `.stage-ui` – testi degli step a sinistra, nome e slider dell'hero.
5. `.hud` – header, barra di progresso, icone step, angolari, lettere di sfondo.
6. `.loader` – preloader, poi rimosso dal DOM.

`html, body { background: #050505 }` da subito, inline nell'`index.html`: zero flash bianchi.

### 4.3 Struttura cartelle

```
src/
  main.ts                    bootstrap, ordine di init, gestione errori WebGL
  config/
    theme.ts                 colori, font, durate, easing (unica fonte)
    bottle.ts                costanti misurate sul GLB (sezione 3)
    keyframes.ts             stato 3D per ogni step, desktop + mobile
  content/
    steps.it.json            testi, tag, icone
  core/
    Ticker.ts                un solo requestAnimationFrame (gsap.ticker)
    Viewport.ts              resize, DPR, breakpoint, safe area
    StepController.ts        wheel/touch/tastiera/click → step target, lock, cooldown
    Progress.ts              p continuo, tween GSAP verso il target, eventi
    StateMapper.ts           p → stato 3D interpolato (camera, bottiglia, uniform)
  gl/
    Renderer.ts              WebGLRenderer, tone mapping, color space
    Stage.ts                 scena, camera, resize
    Environment.ts           env map da lightformer + lama di luce animabile
    Lights.ts                key, rim, spot sul tappo
    Bottle.ts                carica GLB, pivot, materiali, uniform reveal/focus
    materials/
      GlassMaterial.ts
      LabelMaterial.ts       fascia accesa (focus) via onBeforeCompile
      CapMaterial.ts
      revealChunk.glsl       maschera "solo la cima accesa"
    Carousel.ts              bottiglie dell'hero su anello, drag, frecce
    HeroProps.ts             faro circolare + piedistallo (primitive, niente asset esterni)
    Background.ts            canvas #bg con shader gradienti + nebbia
    PostFX.ts
  ui/
    Loader.ts
    Header.ts                logo, audio ON/OFF, MENU, CONTATTI
    Hud.ts                   angolari, trattini, lettere di sfondo
    ProgressBar.ts
    StepIcons.ts
    StepText.ts              uscita/entrata righe, tag barrato
    HeroUI.ts                titolo, frecce, slider, "scorri per scoprire"
    Finale.ts                scritta gigante, CTA
  styles/
    tokens.css  base.css  hud.css  text.css  responsive.css
  debug/
    Debug.ts                 lil-gui con tutti i keyframe e le luci
public/
  models/crisi_economica.glb (ottimizzato)
  fonts/  icons/  audio/ (opzionale)
scripts/
  optimize-glb.sh
```

### 4.4 Flusso dei dati

1. Un gesto (rotella, swipe, freccia, click su icona) arriva a `StepController`.
2. `StepController` decide il nuovo step target, se non è bloccato, e chiama `Progress.goTo(target)`.
3. `Progress` emette `step:leave` (from, to) e anima `p` verso `target` con GSAP; a fine corsa emette `step:enter`.
4. A ogni tick `StateMapper.apply(p)` aggiorna camera, bottiglia, carosello, uniform degli shader, sfondo e barra di progresso.
5. Su `step:leave` i moduli UI (`StepText`, `StepIcons`, `HeroUI`, `Finale`) fanno uscire il vecchio stato ed entrare quello del target, con i tempi della sezione 5.

Nessun modulo legge lo scroll del documento. Nessun modulo tiene un suo `requestAnimationFrame`.

## 5. Motore di scroll a step (l'effetto "salire di livello")

Un gesto = uno step, sempre: una rotellata di 3 px e una spinta lunga del trackpad producono la stessa animazione automatica, lenta e morbida, verso lo step successivo. La pagina non scorre mai liberamente dentro l'esperienza. La barra in alto mostra la percentuale del percorso: `p / N`.

### 5.1 Regole

1. **Input accettati:** rotella/trackpad (`wheel`, `passive: false`, `preventDefault`), swipe touch, tastiera (↓ PagGiù Spazio = avanti; ↑ PagSu Maiusc+Spazio = indietro; Home/Fine = primo/ultimo), click sulle icone step, click su "scorri per scoprire".
2. **Normalizza il delta:** `deltaMode 1` → ×16, `deltaMode 2` → ×altezza finestra.
3. **Riconosci il gesto, ignora l'inerzia.** I trackpad continuano a mandare eventi che calano per \~1 s dopo una spinta. È un gesto nuovo solo se: sono passati più di 160 ms dall'ultimo evento, **oppure** il delta assoluto è più di 1,5 volte il precedente e supera 12 px (accelerazione = nuova intenzione). Dentro un gesto accumula; quando l'accumulo supera 24 px fai **un solo** step e ignora il resto del gesto.
4. **Blocco durante la transizione.** Mentre `p` si sta muovendo, i gesti nella stessa direzione vengono ignorati. Un gesto nella direzione **opposta** inverte subito la corsa (ritarget del tween dal valore attuale): così si sente reattivo senza perdere lentezza.
5. **Touch:** su `touchend` scatta lo step se lo spostamento verticale supera 40 px o la velocità supera 0,3 px/ms. `touchmove` con `preventDefault` solo dentro l'esperienza.
6. **Bordi:** allo step 0 verso l'alto non succede nulla (piccolo rimbalzo di `p` a −0,03 e ritorno, 0,5 s). All'ultimo step verso il basso: se sotto c'è altro contenuto, si sblocca lo scroll nativo (task 8.21); altrimenti rimbalzo.
7. **Salti con le icone:** da 1 a 4 si passa per 2 e 3 senza fermarsi; durata `base + 0,35 s × (distanza − 1)`, massimo 2,6 s. I testi intermedi non compaiono: esce il vecchio, entra direttamente quello del target.
8. **URL:** a ogni arrivo `history.replaceState` con `#step-N`; all'avvio, se c'è un hash valido, parti da quello step senza animazione.
9. **`prefers-reduced-motion`:** durate a 0,45 s, niente rotazioni ampie (dissolvenze), niente fluttuazione.

### 5.2 Durate ed easing (volutamente più lente del riferimento)

| Transizione | Ciao (misurata) | Uranio (default) |
| --- | --- | --- |
| Hero ↔ Primo piano | 1,0 s | 1,6 s |
| Primo piano ↔ Retro F1 | 0,85 s | 1,4 s |
| F1 ↔ F2 ↔ F3 ↔ F4 | 0,5 s (3D) | 1,2 s |
| F4 ↔ Finale | 1,1 s | 1,6 s |

Easing globale del tween di `p`: `CustomEase.create('uranio', 'M0,0 C0.65,0 0.18,1 1,1')` (parte piano, accelera, atterra molto morbida). Tutto in `config/theme.ts`, regolabile da `?debug`.

### 5.3 Coreografia dentro un segmento

`p` va da k a k+1; `t = p − k` è il tempo locale del segmento (0–1). Ogni proprietà del keyframe può avere una finestra `[start, end]` dentro il segmento e una sua curva: `tt = ease(clamp((t − start) / (end − start), 0, 1))`. Così, pur restando funzione pura di `p`, le cose partono sfalsate come nel video (es. hero → primo piano: bottiglie laterali via in `[0, 0.45]`, sfondo in `[0.15, 0.55]`, zoom della protagonista in `[0.25, 1]`).

### 5.4 Codice di partenza

```ts
// core/StepController.ts
export class StepController {
  private acc = 0; private lastT = 0; private lastAbs = 0; private fired = false;
  constructor(private progress: Progress, private root: HTMLElement) {
    root.addEventListener('wheel', this.onWheel, { passive: false });
    root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    root.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    root.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKey);
  }
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const d = e.deltaY * k, abs = Math.abs(d), now = performance.now();
    const newGesture = now - this.lastT > 160 || (abs > this.lastAbs * 1.5 && abs > 12);
    this.lastT = now; this.lastAbs = abs;
    if (newGesture) { this.acc = 0; this.fired = false; }
    if (this.fired) return;
    this.acc += d;
    if (Math.abs(this.acc) >= 24) { this.fired = true; this.step(Math.sign(this.acc)); }
  };
  private step(dir: number) { this.progress.request(this.progress.target + dir, dir); }
  // onTouchStart / onTouchEnd / onKey: vedi regole 5.1
}

// core/Progress.ts
export class Progress extends EventTarget {
  p = 0; target = 0; private tween?: gsap.core.Tween;
  constructor(public readonly last: number) { super(); }
  get moving() { return !!this.tween?.isActive(); }
  request(next: number, dir: number) {
    next = Math.max(0, Math.min(this.last, next));
    const reversing = this.moving && Math.sign(next - this.p) !== Math.sign(this.target - this.p);
    if (next === this.target || (this.moving && !reversing)) return this.bounceIfEdge(dir);
    this.goTo(next);
  }
  goTo(next: number) {
    const from = this.target; this.target = next;
    this.dispatchEvent(new CustomEvent('step:leave', { detail: { from, to: next } }));
    this.tween?.kill();
    this.tween = gsap.to(this, {
      p: next, ease: 'uranio', duration: durationFor(this.p, next),
      onComplete: () => this.dispatchEvent(new CustomEvent('step:enter', { detail: { step: next } })),
    });
  }
}
```

Il rendering legge `progress.p` nel tick condiviso (`gsap.ticker.add`), mai negli `onUpdate` del tween.

## 6. Scena 3D: bottiglie, vetro, luce

Il look da ottenere: vetro scuro quasi nero che vive di riflessi lunghi e morbidi, tappo rosso metallico che brilla, etichetta nitida. La luce racconta: nell'hero illumina la protagonista dall'alto, nel primo piano accende **solo la cima** (collo di vetro e tappo), sul retro accende **solo la fascia** di etichetta di cui si parla.

### 6.1 Renderer e camera

- `WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })` (l'antialias lo fa il composer), `outputColorSpace = SRGBColorSpace`, `toneMapping = AgXToneMapping` (prova anche ACES, scegli a occhio), `toneMappingExposure = 1`.
- DPR: `min(devicePixelRatio, 1.75)` desktop, `1.5` mobile. DPR adattivo: se il frame medio supera 20 ms per 2 s, scendi di 0,25 fino a 1.
- `PerspectiveCamera` FOV 28° (tele da still life: poca distorsione). Near 0,1, far 100.

### 6.2 Preparazione del modello (al caricamento, in `Bottle.ts`)

1. Carica il GLB ottimizzato (task 8.4). Per ogni mesh: `updateWorldMatrix`, `geometry.applyMatrix4(mesh.matrixWorld)`, poi azzera la trasformazione e riparenta nel gruppo `inner`. Così vetro, tappo ed etichetta condividono lo stesso spazio oggetto (serve agli shader).
2. `inner.position.y = -2.09` dentro un `pivot` Group: tutte le rotazioni avvengono attorno al centro della bottiglia.
3. Etichetta: `scale.set(1.012, 1, 1.012)` + `polygonOffset` (factor −2, units −2) per uscire dal vetro.
4. Texture etichetta: `anisotropy = renderer.capabilities.getMaxAnisotropy()`, `colorSpace = SRGBColorSpace`, mipmap attive. Nei primi piani 2008 px sono pochi: chiedi al birrificio l'etichetta vettoriale ed esporta 4096×1686 (stesso layout, stessi margini); finché non c'è usa quella attuale.
5. Scala: misura il bounding box e porta l'altezza a 4,18 unità se l'ottimizzazione l'ha cambiata (tutte le costanti della sezione 3 dipendono da questo).

### 6.3 Materiali

| Parte | Materiale | Valori di partenza |
| --- | --- | --- |
| Vetro | `MeshPhysicalMaterial` | `color #15110d` (scuro caldo, configurabile `GLASS_TINT`), `metalness 0`, `roughness 0.06`, `transmission 0.2`, `thickness 0.5`, `ior 1.5`, `attenuationColor #4a2208`, `attenuationDistance 0.35`, `clearcoat 1`, `clearcoatRoughness 0.03`, `envMapIntensity 1.4`, `specularIntensity 1`. Su mobile/GPU deboli: `transmission 0` e `opacity` piena. |
| Tappo | `MeshPhysicalMaterial` | `color #DB4442` (verifica che, convertito, corrisponda al rosso del sito attuale), `metalness 0.85`, `roughness 0.32`, `clearcoat 1`, `clearcoatRoughness 0.08`, `envMapIntensity 1.6`. |
| Etichetta | `MeshStandardMaterial` | `map` = texture, `transparent true`, `depthWrite false`, `renderOrder 2`, `roughness 0.45`, `metalness 0`. Le parti stampate su plastica PP5 hanno una leggera lucentezza: niente opacità piatta. |

### 6.4 Ambiente e luci

- **Env map fatta in casa** (`Environment.ts`): una piccola scena con piani emissivi ("lightformer") passata a `PMREMGenerator.fromScene`, risoluzione 256. Piani: un softbox grande sopra; due strisce verticali alte e strette a sinistra e destra (danno i riflessi lunghi sul cilindro, come le lattine Ciao); un rimbalzo caldo debole dal basso. Niente HDR pesanti da scaricare.
- **Spot sul tappo:** `SpotLight` dall'alto e leggermente davanti, `angle 0.22`, `penumbra 0.9`, target sulla cima della bottiglia protagonista. Intensità alta nel primo piano (step 1), media nell'hero, quasi zero negli step del retro.
- **Rim light:** due `DirectionalLight` da dietro a sinistra e a destra, colore `#A3302A` negli step, colori diversi per ogni bottiglia del carosello nell'hero. Tengono leggibile la silhouette anche quando il corpo è spento.
- **Fill:** `HemisphereLight` molto debole (0,15) per non avere neri morti.

### 6.5 Shader: cima accesa, fascia accesa, lama di luce

Tre effetti in un'unica patch `onBeforeCompile` su vetro, tappo ed etichetta. Tutti guidati da uniform calcolati da `p` (sezione 7).

- **Reveal (step 1):** sotto l'altezza `uRevealY` il colore scende fino a `uRevealFloor`. Con `uRevealY = 3.2` restano piene solo collo e tappo; il corpo resta in penombra ma leggibile (floor 0,4).
- **Focus (step 2–5):** solo la fascia `uFocusY ± uFocusHalf` e solo l'arco `uFocusAngle ± uFocusAngleHalf` restano accesi; il resto scende a `uFocusFloor` (0,06). Sull'etichetta, dentro la fascia, i pixel chiari ricevono un bagliore rosso (equivalente del testo viola che brilla in Ciao).
- **Sweep:** una lama di luce bianca che attraversa la superficie in orizzontale durante ogni transizione (in un cilindro che ruota sul proprio asse i riflessi dell'ambiente restano fermi: la lama va simulata).

```ts
// gl/materials/patchBottle.ts
export function createBottleUniforms() {
  return {
    uReveal: { value: 0 }, uRevealY: { value: 3.2 }, uRevealSoft: { value: 0.6 }, uRevealFloor: { value: 0.4 },
    uFocus: { value: 0 }, uFocusY: { value: 1.513 }, uFocusHalf: { value: 0.09 }, uFocusSoft: { value: 0.05 },
    uFocusAngle: { value: Math.PI }, uFocusAngleHalf: { value: 0.75 }, uFocusFloor: { value: 0.06 },
    uFocusGlow: { value: new THREE.Color('#DB4442') }, uFocusGlowAmt: { value: 0.35 },
    uSweep: { value: -2 }, uSweepWidth: { value: 0.16 }, uSweepAmt: { value: 0 },
    uDim: { value: 1 },
  };
}

export function patchBottleMaterial(mat: THREE.Material, u: ReturnType<typeof createBottleUniforms>, isLabel: boolean) {
  mat.customProgramCacheKey = () => (isLabel ? 'bottle-label' : 'bottle-surface');
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObjPos;
        uniform float uReveal, uRevealY, uRevealSoft, uRevealFloor;
        uniform float uFocus, uFocusY, uFocusHalf, uFocusSoft, uFocusAngle, uFocusAngleHalf, uFocusFloor, uFocusGlowAmt;
        uniform vec3 uFocusGlow;
        uniform float uSweep, uSweepWidth, uSweepAmt, uDim;`)
      .replace('#include <dithering_fragment>', `
        float revealLit = smoothstep(uRevealY - uRevealSoft, uRevealY + uRevealSoft, vObjPos.y);
        float reveal = mix(1.0, mix(uRevealFloor, 1.0, revealLit), uReveal);
        float ang = atan(vObjPos.x, vObjPos.z);
        float dAng = abs(atan(sin(ang - uFocusAngle), cos(ang - uFocusAngle)));
        float band = (1.0 - smoothstep(uFocusHalf, uFocusHalf + uFocusSoft, abs(vObjPos.y - uFocusY)))
                   * (1.0 - smoothstep(uFocusAngleHalf, uFocusAngleHalf + 0.25, dAng));
        float focus = mix(1.0, mix(uFocusFloor, 1.0, band), uFocus);
        gl_FragColor.rgb *= reveal * focus * uDim;
        ${isLabel ? 'gl_FragColor.rgb += uFocusGlow * uFocusGlowAmt * uFocus * band * dot(gl_FragColor.rgb, vec3(0.333));' : ''}
        float sweep = exp(-pow((normal.x - uSweep) / uSweepWidth, 2.0)) * uSweepAmt;
        gl_FragColor.rgb += vec3(sweep) * (0.6 + 0.4 * reveal);
        #include <dithering_fragment>`);
  };
}
```

Ogni bottiglia ha il **suo** oggetto uniform (materiali clonati, texture condivise): solo la protagonista usa reveal/focus/sweep, le altre solo `uDim`.

### 6.6 Carosello dell'hero (`Carousel.ts`)

- `N = 9` bottiglie (config). Tutte clonate dallo stesso GLB (geometrie condivise, materiali clonati). Per le laterali usa il tappo semplificato più leggero (LOD).
- Disposizione su un anello verticale: `a_i = (i − active) × 2π/N + rot`; `x = sin(a_i) × R`, `z = cos(a_i) × R − R` (la protagonista sta a z = 0, le altre arretrano), `R = 5.5`. Altezze `y` leggermente diverse (±0,35), sfalsate.
- Inclinazioni fisse da una lista con seme (niente `Math.random` a ogni avvio): `rotation.z` tra −0,30 e +0,30, `rotation.x` 0,15–0,30 (si vede il tappo), `rotation.y` varia così ogni bottiglia mostra un pezzo diverso di etichetta. Protagonista: `rotation.z = +0.30` (cima a sinistra, \~17°), `rotation.x = 0.22`, `rotation.y = 0` (fronte).
- Vita: `y += sin(time × 0.6 + i × 1.7) × 0.05`, `rotation.z += sin(time × 0.4 + i) × 0.02`, rotazione lentissima della protagonista sul proprio asse (±0,15 rad).
- Luce: protagonista `uDim 1`; laterali `uDim 0.28` con rim light colorata (rosso, ambra `#F2A33A`, rosso scuro, alternati).
- Interazione solo nell'hero (`p < 0.5`): trascinamento orizzontale con cursore `grab`/`grabbing` che ruota `rot` con inerzia e al rilascio aggancia la bottiglia più vicina (0,8 s, `power3.out`); frecce a puntini ai lati della protagonista = ±1; lo slider in basso è sincronizzato con `active`.
- Predisposto per più birre: `config/beers.ts` con `{ id, name, style, abv, labelUrl, accent }`. Gli slot del carosello ciclano la lista; oggi c'è solo Crisi Economica, quindi tutti gli slot sono Crisi Economica.

### 6.7 Faro e piedistallo (`HeroProps.ts`, solo primitive)

- **Faro** sopra la protagonista, dietro al logo, tagliato dal bordo alto: `CylinderGeometry` piatto in metallo scuro + `TorusGeometry` (R 1,6, tubo 0,06) metallo lucido + disco interno emissivo bianco caldo che si riflette sul tappo. Non copiare il modello Ciao: è un oggetto tuo, forma semplice e pulita.
- **Piedistallo** sotto la protagonista: cilindro basso nero satinato con un filo emissivo rosso sul bordo e un bagliore radiale additivo sotto (sprite con gradiente rosso + ambra). Il nome "CRISI ECONOMICA" in HTML ci si appoggia sopra.
- Uscita verso il primo piano: faro `y += 4` (esce in alto), piedistallo `y −= 4`, nella finestra `[0, 0.5]` del segmento.

### 6.8 Sfondo (`Background.ts`, canvas `#bg`)

Un solo quad a tutto schermo con shader e tre pesi calcolati da `p`: `uHero`, `uStep`, `uFinale` (si incrociano durante le transizioni). Renderizzalo a DPR 0,5: è morbido, non serve risoluzione.

- **Hero:** nero in alto; pavimento: ellisse grigia `#5e5e5e` centrata in basso (0,5; 0,12) che sfuma nel nero; due macchie colorate morbide sotto il piedistallo (rosso `#DB4442` a sinistra, ambra `#F2A33A` a destra) al 25%.
- **Step:** alone radiale `#3A0D0E` centrato a (0,5; 0,25) che sfuma in `#090303` ai bordi + vignettatura.
- **Finale:** nebbia con fbm a 5 ottave animata lenta (`uTime × 0.03`): base `#DB4442`, sbuffi chiari `#FF8A80`/`#FFC2B8`, fondo più scuro `#6B1A12`. Due grandi zone luminose a sinistra e a destra della bottiglia, come nel riferimento.
- **Grana** ovunque: rumore hash ±0,02, cambia a ogni frame.

### 6.9 Post-processing (`PostFX.ts`)

`EffectComposer` di pmndrs con `multisampling: 4`, un solo `EffectPass`: Bloom (`mipmapBlur`, soglia 0,85, intensità 0,6: deve brillare solo il bordo del tappo e le lame di luce), Vignette (offset 0,3, darkness 0,55), Noise (opacità 0,03). Su mobile niente bloom.

### 6.10 Birra dentro (opzionale ma consigliata)

Una `LatheGeometry` costruita dal profilo della sezione 3.2 con raggio ×0,93, piena fino a y ≈ 3,3, `MeshPhysicalMaterial` ambra `#5a2a08` con un filo di emissivo. Si vede solo in controluce attraverso il vetro, dà calore alle rim light. Disattivabile da config.

## 7. Storyboard Uranio: 7 step, keyframe e coreografia

Sette stati, `N = 6` (p da 0 a 6): 0 Hero, 1 Primo piano col tappo acceso, 2–5 le quattro fasce del retro, 6 Finale "ZERO CRISI". La bottiglia ruota sempre nello stesso verso: fronte (0) → retro (π) → di nuovo fronte (2π) nel finale, come un giro completo.

### 7.1 Posizionare la bottiglia per "ancore" (non a mano)

Non scrivere a mano la posizione della bottiglia per ogni step: per ogni step definisci **quale punto della bottiglia** (in coordinate locali del pivot, y da −2,09 a +2,09) deve finire **in quale punto dello schermo** (0–1, origine in alto a sinistra). Un helper ricava la posizione del pivot. Così la composizione regge su ogni formato e i keyframe mobile sono solo ancore diverse.

```ts
// config/solvePivot.ts
export function solvePivot(cam: THREE.PerspectiveCamera, rot: THREE.Euler,
                           localY: number, screen: { x: number; y: number }) {
  const offset = new THREE.Vector3(0, localY, 0).applyEuler(rot);
  const ndc = new THREE.Vector3(screen.x * 2 - 1, -(screen.y * 2 - 1), 0.5).unproject(cam);
  const dir = ndc.sub(cam.position).normalize();
  const t = (offset.z - cam.position.z) / dir.z;            // piano z = offset.z
  const target = cam.position.clone().addScaledVector(dir, t);
  return target.sub(offset);                                 // posizione del pivot
}
```

Calcola i pivot di tutti i keyframe a ogni resize (dopo aver aggiornato la camera di quel keyframe) e mettili in cache; `StateMapper` interpola solo valori già pronti.

### 7.2 Keyframe desktop (base 1440×900)

Ancora = `y locale → punto schermo`. Cima = +2,09; centro = 0; fasce F1–F4 = `uFocusY − 2.09` (sezione 3.4). I valori del pivot in fondo sono il risultato atteso a 16:10, solo per controllo.

| Step | Camera pos → look | Rotazione bottiglia (x, y, z) rad | Ancora | Luce e shader | Sfondo | Pivot atteso |
| --- | --- | --- | --- | --- | --- | --- |
| 0 Hero | (0, 0,4, 17) → (0, 0,2, 0) | (0,22, 0, 0,30) | centro 0 → (0,50; 0,47) | spot faro 0,8; reveal 0; focus 0; laterali `uDim` 0,28 | hero 1 | (0, 0,35, 0) |
| 1 Primo piano | (0, 0, 8) → (0, 0, 0) | (0,25, 0, 0,42) | cima +2,09 → (0,47; 0,14) | spot tappo 3,0; `uReveal` 1, `uRevealY` 3,0, floor 0,4 | step 1 | (0,66, −0,41, 0) |
| 2 · F1 | (0, 0, 7) → (0, 0, 0) | (0,12, π, 0,26) | −0,577 → (0,60; 0,42) | spot 0,2; `uFocus` 1, `uFocusY` 1,513, half 0,089 | step 1 | (0,41, 0,73, 0) |
| 3 · F2 | uguale | (0,12, π, 0,19) | −0,766 → (0,60; 0,42) | `uFocusY` 1,324, half 0,073 | step 1 | (0,41, 0,92, 0) |
| 4 · F3 | uguale | (0,10, π, 0,14) | −1,041 → (0,60; 0,45) | `uFocusY` 1,049, half 0,166 | step 1 | (0,41, 1,20, 0) |
| 5 · F4 | uguale | (0,08, π, 0,10) | −1,369 → (0,60; 0,45) | `uFocusY` 0,721, half 0,139 | step 1 | (0,42, 1,53, 0) |
| 6 Finale | (0, 0, 15) → (0, 0, 0) | (0,06, 2π, −0,06) | centro 0 → (0,50; 0,52) | spot 1,0; reveal 0; focus 0 | finale 1 | (0, −0,15, 0) |

Negli step 2–5 la bottiglia **sale** a ogni step (0,73 → 0,92 → 1,20 → 1,53) e si raddrizza (15° → 11° → 8° → 6°): è il movimento di Ciao, ottenuto con le ancore. La fascia accesa resta sempre alla stessa altezza dello schermo, a destra del testo.

### 7.3 Keyframe mobile (verticale, base 390×844)

Testo in basso (dal 60% al 92% dell'altezza) sopra una sfumatura scura; bottiglia sopra e centrata. Hero: camera z 22, ancora centro → (0,50; 0,40), 5 bottiglie visibili. Primo piano: camera z 11, cima → (0,52; 0,10). F1–F4: camera z 9,5, fascia → (0,56; 0,30). Finale: camera z 19, centro → (0,50; 0,42). Le icone step passano in una riga orizzontale sopra il testo.

### 7.4 Coreografia dentro ogni segmento (finestre su t da 0 a 1)

| Segmento | Cosa si muove e quando |
| --- | --- |
| 0 → 1 Hero → Primo piano | Laterali via verso l'esterno (`x += sign(x) × 8`, `z −= 4`, `uDim → 0`) in \[0; 0,5\], poi `visible = false`. Faro su e piedistallo giù in \[0; 0,5\]. Sfondo hero → step in \[0,15; 0,6\]. Camera e pivot della protagonista in \[0,2; 1\]. `uReveal` 0 → 1 e spot sul tappo in \[0,4; 1\]. Lama di luce in \[0,3; 0,9\]. |
| 1 → 2 Primo piano → F1 | Rotazione y 0 → π in \[0; 0,85\] (`power2.inOut`). Tilt e ancora in \[0,1; 1\]. `uReveal` 1 → 0 e spot giù in \[0; 0,45\]. `uFocus` 0 → 1 in \[0,45; 1\]. Lama di luce in \[0,15; 0,75\]. |
| 2 ↔ 3 ↔ 4 ↔ 5 | Ancora e tilt in \[0; 1\]. `uFocusY` e `uFocusHalf` interpolati in \[0,1; 0,9\]: la fascia accesa scivola sul paragrafo nuovo. Lama di luce leggera (amt 0,4) in \[0,2; 0,8\]. |
| 5 → 6 F4 → Finale | `uFocus` 1 → 0 in \[0; 0,35\]. Rotazione y π → 2π in \[0,1; 0,9\]. Camera e ancora in \[0,1; 1\]. Sfondo step → finale in \[0,2; 0,8\]. |

Curva dentro le finestre: `power2.inOut` di default. Il tween globale di `p` aggiunge già l'easing "uranio": non raddoppiare curve aggressive o il movimento diventa a scatti.

**Lama di luce:** in ogni finestra `uSweep` va da −1,5 a +1,5 e `uSweepAmt = sin(π × tt) × amt` (amt 1,0 di default). Al ritorno all'indietro scorre al contrario da sola, perché è funzione di `p`.

**Vita a riposo** (sommata sopra lo stato di `p`, smorzata a 0 mentre `p` si muove): fluttuazione `y ± 0.03` periodo 5 s, rotazione z `± 0.01`, nebbia del finale sempre animata, oscillazione y della bottiglia del finale `± 0.12 rad` periodo 8 s.

### 7.5 Interfaccia per step (discreta, legata allo step di destinazione)

| Elemento | 0 Hero | 1 Primo piano | 2–5 Retro | 6 Finale |
| --- | --- | --- | --- | --- |
| Header (audio, logo, menu, contatti) | sì | sì | sì | sì |
| Barra di progresso `p / 6` | sì (quasi vuota) | sì | sì | piena |
| Angolari e lettere HUD | sì | sì | sì | sì, opacità più bassa |
| Nome + slider + "scorri per scoprire" + frecce | sì | — | — | — |
| Blocco testo a sinistra | — | titolo + paragrafo | tag + titolo + paragrafo | — |
| Icone step a destra | — | sì, nessuna attiva | sì, attiva quella dello step | — |
| Scritta gigante + CTA | — | — | — | sì |

### 7.6 Animazione dei testi (`StepText.ts`)

Come nel video: le righe vecchie escono verso l'alto tagliate da una maschera, poi entrano le nuove dal basso con un filo di sfocato. Usa `SplitText` con `type: 'lines', mask: 'lines'`.

- **Uscita** (alla partenza della transizione): titolo prima, poi le righe del paragrafo, poi il tag. `yPercent: -105`, `skewY: -4`, `duration 0.4`, `stagger 0.05`, `ease 'power2.in'`.
- **Entrata** (parte al 45% della durata della transizione): tag → titolo → paragrafo. Righe da `yPercent: 105`, `opacity 0`, `filter: blur(8px)` a valori pieni, `duration 0.7`, `stagger 0.07`, `ease 'power3.out'`.
- **Tag:** riquadro rosso `#DB4442` 22×22 px con "×" bianco + etichetta bianca con testo nero maiuscolo 12 px, spaziatura 0,04 em. Entra con `scaleX` 0 → 1 da sinistra (0,35 s). Se il tag è barrato, 0,4 s dopo l'entrata del titolo una linea nera da 1,5 px attraversa il testo da sinistra a destra (`scaleX` 0 → 1, 0,45 s, `power2.inOut`).
- **Salti** (click su un'icona lontana): esce il vecchio, entra direttamente il testo del target.
- **Interruzioni:** se la direzione si inverte a metà, uccidi le timeline in corso (`kill`) e fai entrare il testo del nuovo target dallo stato attuale; mai due blocchi di testo visibili insieme.
- **Hero → Primo piano:** il nome sul piedistallo esce (opacità + `y 20`, 0,35 s) mentre il blocco a sinistra entra.
- **Finale:** la scritta gigante "ZERO / CRISI" entra lettera per lettera (`SplitText` per caratteri, `opacity 0 → 0.35`, `blur 12px → 0`, `y 30 → 0`, `stagger 0.05`, `from: 'random'`). Font display 900 corsivo, `font-size: clamp(120px, 22vw, 360px)`, interlinea 0,85, bianco.
- Ogni blocco di testo ha `aria-live="polite"` e resta nel DOM leggibile dagli screen reader.

## 8. Mini task: un task = un commit

28 task in 5 fasi, da eseguire in ordine. Per ogni task: fai solo quello, verifica i criteri "Fatto quando", fai `npm run build` senza errori, poi committa con il messaggio indicato (Conventional Commits, in italiano). Se un task scopre un problema di un task precedente, correggilo in un commit `fix:` separato. Alla fine di ogni fase fermati e mostrami uno screenshot o un breve video.

### Fase A — Fondamenta

**8.1 Audit del sito attuale**

- Commit: `chore: audit del sito attuale e branch feat/scroll-3d`
- Fai: crea il branch `feat/scroll-3d`. Leggi tutto il repo e scrivi `docs/AUDIT.md`: stack, build, deploy, come viene caricato oggi il GLB, font e logo usati, pagine e sezioni sotto l'hero da conservare. Sposta il GLB originale in `assets-src/` (fuori da `public`).
- Fatto quando: `AUDIT.md` risponde a "cosa tengo, cosa sostituisco"; nessun file del sito è cambiato.

**8.2 Setup del progetto**

- Commit: `chore: setup vite, typescript e dipendenze`
- Fai: Vite + TypeScript `strict`, ESLint + Prettier. Dipendenze: `three`, `gsap`, `postprocessing`, `meshoptimizer`; dev: `@types/three`, `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `sharp`, `lil-gui`, `stats-gl`, `@playwright/test`. `index.html` con gli strati della sezione 4.2 e `background:#050505` inline nel `<head>`. Se il repo è React/Next, adatta (vedi 4.1) e annotalo in `AUDIT.md`.
- Fatto quando: `npm run dev` mostra una pagina nera a tutto schermo senza scrollbar e senza flash bianchi al refresh.

**8.3 Token, font e tipografia**

- Commit: `feat(style): token colori, font e scala tipografica`
- Fai: `tokens.css` e `theme.ts` con la palette 3.5 (stessi valori). Font della sezione 3.6 in `woff2` self-hosted con `<link rel="preload">`. Classi: `.t-display` (900, corsivo, larghezza 118, maiuscolo, `line-height .88`, `letter-spacing -.01em`, `clamp(40px, 4.6vw, 72px)`), `.t-body` (`clamp(16px, 1.25vw, 19px)`, `line-height 1.45`, max 46ch), `.t-label` (12 px, maiuscolo, `letter-spacing .08em`). Nessuna animazione di testo parte prima di `document.fonts.ready`.
- Fatto quando: una pagina `?debug=type` mostra tutti gli stili con i testi reali.

**8.4 Ottimizzazione del GLB**

- Commit: `perf(assets): ottimizza il GLB della bottiglia`
- Fai: `scripts/optimize-glb.mjs` con gltf-transform (vedi appendice 10.3): dedup, flatten, weld, **simplify solo sul tappo** (da 107k a \~8–12k vertici, errore massimo 0,0005), texture etichetta in WebP qualità 92 (o KTX2), compressione meshopt. Output `public/models/crisi_economica.glb`. Script npm `optimize:glb`.
- Fatto quando: file sotto 1,2 MB; confronto a schermo prima/dopo identico a occhio a 1440 px; il tappo resta tondo e con la zigrinatura leggibile.

### Fase B — Core

**8.5 Ticker, viewport e debug**

- Commit: `feat(core): ticker unico, viewport e pannello debug`
- Fai: `Ticker.ts` su `gsap.ticker` (unico loop, delta e tempo); `Viewport.ts` (dimensioni, DPR limitato, breakpoint `mobile < 768px`, eventi resize con debounce 100 ms); `Debug.ts` con lil-gui e stats-gl attivi solo con `?debug`, con un pulsante "copia keyframe" che mette in clipboard il JSON dei valori correnti.
- Fatto quando: con `?debug` vedi fps e pannello; senza, zero codice di debug caricato (import dinamico).

**8.6 Progress e StepController**

- Commit: `feat(core): motore di scroll a step con gestione dell'inerzia`
- Fai: tutto il punto 5 (regole 5.1, durate 5.2, codice 5.4). Eventi `step:leave` e `step:enter`. Overlay di debug con `p`, target e stato del lock.
- Fatto quando: con un trackpad Mac, una spinta forte fa **un solo** step; una rotellina a scatti fa uno step per gesto; l'inversione a metà corsa torna indietro fluida; tastiera e swipe funzionano; `#step-3` all'avvio apre lo step 3.

**8.7 StateMapper e keyframe**

- Commit: `feat(core): keyframe e interpolazione dello stato da p`
- Fai: `keyframes.ts` con le tabelle 7.2 e 7.3, `solvePivot` (7.1), finestre di coreografia (7.4). `StateMapper.apply(p)` produce un oggetto stato (camera, pivot, rotazioni, uniform, pesi sfondo, `uDim` laterali, intensità luci) senza toccare la scena; i moduli GL lo applicano. Interpola le rotazioni come numeri (non quaternioni) così 0 → π → 2π gira sempre nello stesso verso.
- Fatto quando: test unitari su `StateMapper` (p = 0, 0,5, 1, 3,25, 6) restituiscono valori attesi; nessun salto tra la fine di un segmento e l'inizio del successivo.

### Fase C — 3D

**8.8 Renderer, stage, ambiente**

- Commit: `feat(gl): renderer, camera ed environment con lightformer`
- Fai: punti 6.1 e 6.4 (env map). Canvas `#gl` trasparente sopra `#bg`.
- Fatto quando: una sfera di prova metallica mostra i riflessi delle strisce verticali e del softbox.

**8.9 Bottiglia e materiali**

- Commit: `feat(gl): bottiglia con materiali di vetro, tappo ed etichetta`
- Fai: punti 6.2 e 6.3. Pivot al centro. Fix dell'etichetta dentro il vetro. Anisotropia.
- Fatto quando: nessuno z-fighting sull'etichetta a nessuna distanza; vetro scuro con riflessi lunghi; tappo rosso brillante; il testo del retro è leggibile a camera z = 7.

**8.10 Shader reveal, focus e sweep**

- Commit: `feat(gl): shader per cima accesa, fascia accesa e lama di luce`
- Fai: punto 6.5. Debug `?debug=bands`: mostra la texture dell'etichetta in un angolo con i 4 rettangoli F1–F4 disegnati sopra e fa ciclare `uFocus` sulle 4 fasce in 3D. Correggi i valori della tabella 3.4 se non combaciano e aggiornali in `config/bottle.ts`.
- Fatto quando: ogni fascia accende esattamente il suo blocco di testo del retro e nient'altro; con `uReveal = 1` si vedono pieni solo collo e tappo; la lama di luce attraversa la bottiglia senza artefatti sul bordo.

**8.11 Luci**

- Commit: `feat(gl): spot sul tappo e rim light`
- Fai: spot, rim e fill del punto 6.4, intensità guidate dallo stato.
- Fatto quando: nel primo piano il punto più luminoso dello schermo è il bordo del tappo, la silhouette resta leggibile anche negli step bui.

**8.12 Sfondo**

- Commit: `feat(gl): sfondo studio, alone degli step e nebbia del finale`
- Fai: punto 6.8 nel canvas `#bg`, con pesi da `p`.
- Fatto quando: le tre atmosfere si fondono senza bande (dithering/grana attivi) e senza salti di luminosità.

**8.13 Carosello dell'hero**

- Commit: `feat(gl): carosello di bottiglie dell'hero con drag e frecce`
- Fai: punto 6.6. Regola `R` (tra 5,5 e 7) finché a 1440×900 si vedono 7 bottiglie, le estreme tagliate dai bordi come nel riferimento.
- Fatto quando: drag fluido con aggancio, frecce ±1, fluttuazione sfalsata, uscita verso l'esterno nel segmento 0 → 1 e rientro identico al ritorno.

**8.14 Faro e piedistallo**

- Commit: `feat(gl): faro e piedistallo dell'hero`
- Fai: punto 6.7, solo primitive Three.js.
- Fatto quando: il faro illumina dall'alto la protagonista, il piedistallo ha il filo rosso e il bagliore sotto; entrambi escono dal frame nel segmento 0 → 1.

**8.15 Post-processing**

- Commit: `feat(gl): bloom selettivo, vignetta e grana`
- Fai: punto 6.9.
- Fatto quando: brilla solo ciò che deve (bordo del tappo, lama di luce, disco del faro); i testi HTML non sono toccati dagli effetti.

### Fase D — Interfaccia

**8.16 Header e HUD**

- Commit: `feat(ui): header, angolari e lettere HUD`
- Fai: header alto 96 px (64 px mobile). Sinistra: "AUDIO" + stato ON/OFF + 4 barrette (2×10 px) che oscillano in `scaleY` quando l'audio è attivo. Centro: logo Uranio SVG (quello del sito attuale), 120 px. Destra: "⁚⁚ MENU" (apre il menu esistente del sito a tutto schermo) e bottone pillola "CONTATTI": fondo bianco, testo nero 14 px maiuscolo, padding 14×22 px, raggio 8 px, `box-shadow: 0 0 24px rgba(255,255,255,.35)`. Angolari a L da 10 px, linea 1 px `rgba(255,255,255,.5)`, inset 36 px (16 px mobile). Trattini da 6 px sui bordi laterali al 25/50/75% dell'altezza. Lettere HUD (3.7): Inter 11 px, opacità 0,28, riga alta al 25% e riga bassa al 75% dell'altezza, distribuite su tutta la larghezza; all'avvio compaiono in ordine casuale (30 ms l'una).
- Fatto quando: l'HUD è nitido a ogni DPR, non intercetta i gesti (`pointer-events: none` tranne i controlli) e non copre la bottiglia nei punti chiave.

**8.17 Barra di progresso e icone step**

- Commit: `feat(ui): barra di progresso e icone degli step`
- Fai: barra in alto a 22 px dal bordo, inset laterale 70 px: binario 1 px `rgba(255,255,255,.2)`, riempimento bianco 1 px, testa luminosa (60 px di gradiente trasparente → bianco + alone `0 0 12px #fff`), puntini da 2 px alle estremità; larghezza = `p / 6`, letta a ogni tick. Icone: 4 cerchi da 62 px, bordo 1 px `rgba(255,255,255,.25)`, fondo `rgba(255,255,255,.04)` con `backdrop-filter: blur(6px)`, icona SVG 26 px (spiga, fulmine, goccia, riciclo; usa Lucide `wheat`, `zap`, `droplet`, `recycle`, licenza ISC), 3 puntini tra un cerchio e l'altro. Attiva: bordo 1,5 px bianco, fondo `rgba(219,68,66,.25)`, alone `0 0 18px rgba(219,68,66,.6)`, transizione 0,4 s. Click = `goTo(step)`. `aria-label` col titolo dello step, `aria-current="step"` sull'attiva.
- Fatto quando: la barra avanza in modo continuo durante le transizioni; le icone entrano sfalsate (0,08 s) al passaggio 0 → 1 ed escono verso il finale.

**8.18 Testi degli step**

- Commit: `feat(ui): testi degli step con uscita e entrata a righe e tag barrato`
- Fai: punto 7.6 completo. Blocco testo a sinistra: `left: 10vw`, centrato verticalmente al 45%, larghezza max 520 px, angolari piccoli (8 px) in alto a sinistra e in basso a destra del blocco. Contenuti da `steps.it.json`.
- Fatto quando: in nessun momento due testi si sovrappongono; il tag barrato si disegna dopo il titolo; avanti e indietro rapidi non lasciano righe orfane o invisibili.

**8.19 Interfaccia dell'hero**

- Commit: `feat(ui): nome, slider e invito a scorrere dell'hero`
- Fai: logotipo "CRISI ECONOMICA" a pennello (ritaglio dalla texture o vettoriale) appoggiato sul piedistallo, sotto "ORDINARY BITTER · 4,2%" in `.t-label`. Frecce a puntini (5 puntini a chevron) a ±120 px dalla protagonista. Slider: binario 2 px largo 600 px (80vw mobile) con gradiente `#6B1A12 → #DB4442 → #F2A33A → #F8F8F8`, pallino 18 px bianco con anello; sincronizzato col carosello. "SCORRI PER SCOPRIRE" in basso, cliccabile (= step avanti), con una lineetta che pulsa piano.
- Fatto quando: tutto esce al passaggio 0 → 1 e rientra uguale al ritorno.

**8.20 Finale**

- Commit: `feat(ui): finale con scritta gigante e call to action`
- Fai: `.bigword` "ZERO / CRISI" (7.6) dietro al canvas `#gl`, centrata. Sotto la bottiglia: riga piccola "Conservare al freddo e al buio. Contiene deposito naturale." e due bottoni: "SEGUICI @URANIO.BEER" (link Instagram) e "DOVE TROVARLA" (ancora alla sezione contatti/punti vendita esistente). Bottiglia con oscillazione lenta (7.4).
- Fatto quando: la scritta compare lettera per lettera dopo che la bottiglia si è quasi fermata; al ritorno sparisce prima che la bottiglia ricominci a ruotare.

**8.21 Uscita verso il resto della pagina**

- Commit: `feat(core): passaggio dallo scroll a step allo scroll nativo dopo il finale`
- Fai: se sotto l'esperienza ci sono sezioni del sito attuale (vedi `AUDIT.md`), allo step 6 un gesto verso il basso sblocca lo scroll nativo: l'esperienza (`position: sticky` dentro un contenitore alto 100svh) scorre via verso l'alto e il resto della pagina segue normalmente. Con `IntersectionObserver` metti in pausa il rendering quando l'esperienza non è visibile. Tornando su fino in cima, un gesto verso l'alto riaggancia lo scroll a step allo step 6. Se sotto non c'è nulla, rimbalzo (5.1 regola 6).
- Fatto quando: il passaggio è senza scatti in entrambe le direzioni, anche con l'inerzia del trackpad.

### Fase E — Rifinitura

**8.22 Preloader e ingresso**

- Commit: `feat(ui): preloader e animazione d'ingresso`
- Fai: schermo nero, logo Uranio, linea sottile di avanzamento (GLB + font + env map) e percentuale. A caricamento finito: la linea si riempie, il logo sfuma; il faro si accende con due piccoli sfarfallii da neon; le bottiglie del carosello salgono dal basso sfalsate (0,06 s) mentre si accendono; poi entrano nome, slider e invito. Totale 2,2 s, saltato con reduced motion.
- Fatto quando: niente pop-in di geometrie o font; il primo frame visibile è già composto.

**8.23 Responsive**

- Commit: `feat(responsive): keyframe e layout mobile e tablet`
- Fai: keyframe 7.3, layout testi in basso con sfumatura `linear-gradient(transparent, rgba(5,5,5,.85) 35%)`, icone in riga orizzontale, slider all'80% della larghezza, `100svh` ovunque, safe area iOS. Tablet orizzontale = desktop; tablet verticale = mobile con camera un po' più lontana.
- Fatto quando: a 390×844, 768×1024 e 1440×900 la bottiglia non copre mai i testi e la fascia accesa è sempre leggibile.

**8.24 Accessibilità e fallback**

- Commit: `feat(a11y): tastiera, screen reader, reduced motion e fallback senza WebGL`
- Fai: focus visibile su tutti i controlli; ordine di tabulazione logico; testi sempre nel DOM; `prefers-reduced-motion` (5.1 regola 9); se WebGL2 non c'è o il contesto si perde: versione statica con immagini della bottiglia esportate dai keyframe e sezioni di testo a scroll normale.
- Fatto quando: si percorre tutta l'esperienza solo con la tastiera; VoiceOver legge titolo e testo di ogni step; il fallback funziona disattivando WebGL nel browser.

**8.25 Audio (opzionale)**

- Commit: `feat(audio): toggle audio con stappo e tintinnio`
- Fai: audio spento di default (i browser bloccano l'autoplay). Con ON: tappeto sonoro leggero in loop, suono di stappo nel passaggio 0 → 1, tintinnio di vetro leggero a ogni step. Volumi bassi, dissolvenze 0,3 s. Servono file audio dal birrificio o con licenza libera: se non ci sono, lascia il toggle pronto e i file vuoti documentati.
- Fatto quando: lo stato ON/OFF è ricordato in `localStorage` e non parte mai suono senza un click.

**8.26 Birra dentro la bottiglia (opzionale)**

- Commit: `feat(gl): liquido ambra dentro la bottiglia`
- Fai: punto 6.10.
- Fatto quando: in controluce si intuisce la birra ambrata, senza intaccare la leggibilità dell'etichetta.

**8.27 Performance**

- Commit: `perf: DPR adattivo, budget e caricamento pigro`
- Fai: DPR adattivo (6.1), sfondo a DPR 0,5 e max 30 fps, pausa con tab nascosta, nessuna allocazione nel loop (vettori riusati), texture e materiali condivisi tra i cloni, import dinamico di debug e postprocessing su mobile.
- Fatto quando: rispetti i budget della sezione 9.

**8.28 QA finale e documentazione**

- Commit: `test: percorso e2e con screenshot e checklist finale`
- Fai: script Playwright che a 1440×900 e 390×844 percorre gli step 0 → 6 → 0 con la tastiera, aspetta `step:enter` e salva gli screenshot in `qa/screens/`. Guarda gli screenshot e confrontali con le composizioni della sezione 7 (posizione del tappo, della fascia, dei testi); correggi i keyframe dove sbagliano. Aggiorna il `README` con: come si avvia, come si regolano i keyframe con `?debug`, come si cambiano testi e birre.
- Fatto quando: tutta la checklist della sezione 9 è spuntata.

## 9. Budget e criteri di accettazione

L'esperienza è finita quando tutte le caselle sotto sono spuntate e i budget sono rispettati sui dispositivi indicati.

### 9.1 Budget

| Voce | Limite |
| --- | --- |
| GLB ottimizzato | < 1,2 MB |
| JavaScript iniziale (gzip) | < 350 KB, debug escluso |
| Primo frame composto (4G veloce) | < 3 s |
| Fluidità desktop (MacBook Air M1, Chrome) | 60 fps stabili, anche durante le transizioni |
| Fluidità mobile (iPhone 12 Safari, Android di fascia media) | ≥ 45 fps, mai sotto 30 |
| Draw call nell'hero | < 60 |
| Memoria GPU texture | < 64 MB |

### 9.2 Checklist

- [ ] Un gesto = uno step, con rotellina, trackpad (inerzia inclusa), touch e tastiera.
- [ ] Ogni transizione dura quanto in tabella 5.2, parte e atterra morbida, e si riavvolge identica all'indietro.
- [ ] Inversione a metà corsa fluida; salti con le icone senza testi intermedi.
- [ ] Hero: 7 bottiglie visibili a 1440×900, inclinate in modo vario, che fluttuano; protagonista illuminata dal faro; drag e frecce funzionano.
- [ ] Primo piano: il punto più luminoso è il tappo; collo e tappo pieni, corpo in penombra, fronte dell'etichetta leggibile in basso.
- [ ] Retro: ogni step accende solo la sua fascia (F1–F4) e la bottiglia sale e si raddrizza a ogni step.
- [ ] Lama di luce visibile in ogni transizione, mai durante le pause.
- [ ] Finale: nebbia rossa viva, "ZERO / CRISI" lettera per lettera dietro la bottiglia, CTA funzionanti.
- [ ] Testi: uscita a righe verso l'alto con maschera, entrata dal basso con sfocato, tag barrato disegnato dopo il titolo; mai due testi sovrapposti.
- [ ] HUD completo: header, barra di progresso continua, icone step con stato attivo, angolari, lettere di sfondo.
- [ ] Nessuno z-fighting, nessun flash bianco, nessun salto di layout, nessun pop-in di font o geometrie.
- [ ] Mobile 390×844 e tablet: composizioni della sezione 7.3, testi mai coperti.
- [ ] Reduced motion, tastiera, screen reader e fallback senza WebGL funzionanti.
- [ ] Nessun asset, testo o logo di Ciao Energy nel progetto.
- [ ] `README` aggiornato e screenshot QA in `qa/screens/`.

## 10. Regole per Claude Code e appendici

### 10.1 Regole di lavoro

1. Leggi tutto il documento prima di iniziare. Poi scrivimi il piano in massimo 10 righe e parti dal task 8.1 senza aspettare conferma.
2. Un task = un commit. Mai due task nello stesso commit, mai un task diviso in commit sparsi (salvo `fix:` successivi).
3. Prima di ogni commit: lint, typecheck, `npm run build`. Se qualcosa fallisce, non committare.
4. Nessun numero magico nel codice: colori, durate, easing, keyframe, costanti della bottiglia stanno in `src/config/`.
5. Le API di `three`, `gsap`, `postprocessing` e `@gltf-transform` cambiano spesso: controlla la versione installata e la sua documentazione prima di usare un metodo. Gli snippet di questo documento sono un punto di partenza, non codice da incollare alla cieca.
6. Misura, non indovinare: regola i valori con `?debug`, copia il JSON in config, e verifica con screenshot Playwright. Guarda davvero gli screenshot prima di dire che una composizione è giusta.
7. Se un valore di questo documento si rivela sbagliato (es. una fascia non combacia), correggilo in config e annota il valore nuovo in `docs/AUDIT.md`.
8. Alla fine di ogni fase (A–E) fermati, mostrami screenshot o video e un elenco di cosa resta da decidere.
9. Non usare asset, testi, font o loghi di Ciao Energy. Se ti manca un asset Uranio, usa un segnaposto evidente e aggiungilo alle domande aperte.
10. Non toccare le sezioni del sito attuale sotto l'hero, salvo quanto serve al task 8.21.

### 10.2 Domande aperte per il birrificio (non bloccanti: procedi con i segnaposto)

- [ ] Etichetta vettoriale (AI/PDF/SVG) per esportare la texture a 4096 px.
- [ ] Logo Uranio in SVG e logotipo "CRISI ECONOMICA" in vettoriale.
- [ ] Conferma dei testi della tabella 3.7.
- [ ] Altre birre da mettere nel carosello (nome, stile, gradazione, etichetta).
- [ ] File audio (tappeto, stappo, tintinnio) o via libera a suoni con licenza libera.
- [ ] Link Instagram e destinazione del bottone "DOVE TROVARLA".

### 10.3 Script di ottimizzazione del GLB

```js
// scripts/optimize-glb.mjs  — verifica i nomi delle funzioni sulla versione installata
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, weld, prune, simplifyPrimitive, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptEncoder });
const doc = await io.read('assets-src/Crisi_Economica_etichettata.glb');

await doc.transform(dedup(), flatten(), weld());

// semplifica SOLO il tappo (mesh "Object_0.002", ~107k vertici)
for (const mesh of doc.getRoot().listMeshes()) {
  if (!mesh.getName().includes('Object_0.002')) continue;
  for (const prim of mesh.listPrimitives()) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.1, error: 0.0005 });
  }
}

await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write('public/models/crisi_economica.glb', doc);
```

Nel loader: `gltfLoader.setMeshoptDecoder(MeshoptDecoder)` (da `three/examples/jsm/libs/meshopt_decoder.module.js`).

### 10.4 Shader dello sfondo (`Background.ts`)

```glsl
// fragment — colori passati come THREE.Color, chiudi con <colorspace_fragment>
uniform vec2 uRes; uniform float uTime, uHero, uStep, uFinale;
uniform vec3 cBlack, cFloor, cRed, cAmber, cOx, cNight, cFog1, cFog2, cFog3, cDeep;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  float asp = uRes.x / uRes.y; vec2 q = vec2((vUv.x - 0.5) * asp, vUv.y);
  // hero: studio con pavimento chiaro e due macchie colorate
  float fl = smoothstep(0.9, 0.0, length(vec2(q.x * 0.55, (vUv.y - 0.12) * 1.6)));
  vec3 hero = mix(cBlack, cFloor, fl * 0.9)
            + cRed   * 0.25 * smoothstep(0.35, 0.0, length(q - vec2(-0.30, 0.05)))
            + cAmber * 0.20 * smoothstep(0.35, 0.0, length(q - vec2( 0.30, 0.05)));
  // step: alone rosso scuro
  vec3 stp = mix(cNight, cOx, smoothstep(1.1, 0.0, length(vec2(q.x * 0.8, (vUv.y - 0.25) * 1.2))));
  // finale: nebbia viva
  vec2 fp = q * 1.6 + vec2(uTime * 0.03, -uTime * 0.015);
  float n = fbm(fp + fbm(fp * 0.8 + uTime * 0.02));
  vec3 fog = mix(cDeep, cFog1, smoothstep(0.0, 0.9, vUv.y * 0.6 + n * 0.7));
  fog = mix(fog, cFog2, smoothstep(0.55, 0.85, n));
  fog = mix(fog, cFog3, smoothstep(0.75, 0.95, n) * 0.6);
  vec3 col = hero * uHero + stp * uStep + fog * uFinale;
  col *= mix(0.55, 1.0, smoothstep(1.2, 0.35, length((vUv - 0.5) * vec2(asp * 0.9, 1.0))));
  col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.035;   // grana
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
```

### 10.5 Scheletro di `StepText`

```ts
export class StepText {
  private cur?: { el: HTMLElement; split: SplitText; tl?: gsap.core.Timeline };
  show(step: StepContent | null, transitionDuration: number) {
    const prev = this.cur;
    if (prev) {
      prev.tl?.kill();
      gsap.to(prev.split.lines, { yPercent: -105, skewY: -4, duration: 0.4, stagger: 0.05, ease: 'power2.in',
        onComplete: () => { prev.split.revert(); prev.el.remove(); } });
    }
    if (!step) { this.cur = undefined; return; }
    const el = this.render(step);                       // tag + h2.t-display + p.t-body dal JSON
    const split = SplitText.create(el.querySelectorAll('.t-display, .t-body'), { type: 'lines', mask: 'lines' });
    const tl = gsap.timeline({ delay: transitionDuration * 0.45 })
      .from(el.querySelector('.tag'), { scaleX: 0, transformOrigin: 'left center', duration: 0.35, ease: 'power3.out' })
      .from(split.lines, { yPercent: 105, opacity: 0, filter: 'blur(8px)', duration: 0.7, stagger: 0.07, ease: 'power3.out' }, '-=0.15');
    const strike = el.querySelector('.tag .strike');
    if (strike) tl.from(strike, { scaleX: 0, transformOrigin: 'left center', duration: 0.45, ease: 'power2.inOut' }, '>-0.2');
    this.cur = { el, split, tl };
  }
}
```

### 10.6 Come usare questo documento

Incollalo intero come primo messaggio in Claude Code dalla cartella del sito, insieme a `Crisi_Economica_etichettata.glb`, `CRISI_ECONOMICA_etichetta.png` e il video di riferimento in `docs/reference/`. Poi scrivi: "Leggi la spec e inizia dal task 8.1".

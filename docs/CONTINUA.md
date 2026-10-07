# Continua da qui

Documento di passaggio di consegne. Leggilo tutto, poi riprendi dal **task
8.5**. La spec completa è `docs/URANIO_SCROLL_SPEC.md`, le decisioni già prese
stanno in `docs/AUDIT.md`: leggi entrambi prima di scrivere codice.

## Regola che vale su tutto

**Non fermarti e non fare domande. Finisci il lavoro.**

La spec dice (regola 10.1.8) di fermarsi a fine di ogni fase e mostrare
screenshot. **Quella regola è sospesa**: vai dritto dal task 8.5 al 8.28 senza
pause e senza chiedere conferme. Non esistono domande bloccanti — ogni dubbio
aperto ha già una risposta di default qui sotto, usala. Se incontri una scelta
non prevista, prendila tu, annotala in `docs/AUDIT.md` e tira dritto.

Un task = un commit, in italiano, all'imperativo, come già fatto. Prima di ogni
commit: `npx tsc -b`, `npx eslint src`, `npm run build`. Se qualcosa fallisce,
aggiusta e poi committa. Resti su `main`, non fai `push`.

Quando arrivi in fondo al 8.28, fermati lì e scrivi un resoconto finale di cosa
è stato fatto e cosa resta non verificabile.

## Dove sei

Fase A finita. Quattro commit su `main`:

| commit | task | cosa |
| --- | --- | --- |
| `6bb9576` | 8.1 | audit, spec versionata, GLB sorgente in `assets-src/` |
| `3a89d13` | 8.2 | dipendenze, `strict`, scheletro strati su `/esperienza` |
| `bc02fc5` | 8.3 | palette, Archivo variabile, `?debug=type` |
| `852ff4b` | 8.4 | GLB 5,8 MB → 320 KB |

Prossimo: **8.5** (Ticker, Viewport, Debug), poi 8.6, 8.7… fino al 8.28.

## Risposte di default alle domande aperte

Non chiedere nessuna di queste. Usa la risposta e vai avanti.

| Domanda | Risposta da usare |
| --- | --- |
| Branch `feat/scroll-3d`? | **No.** `CLAUDE.md` impone `main`, è l'autorizzazione del proprietario. |
| Logo Uranio in SVG? | **Non c'è.** Usa `src/assets/uranio-mark.png` come segnaposto e scrivi `TODO: serve l'SVG` accanto. |
| Logotipo "CRISI ECONOMICA" vettoriale? | **Non c'è.** Ritaglialo dalla texture dell'etichetta (zona fronte, x 20–860 su 2008 px) con `sharp` in uno script, output in `public/images/`. |
| Testi confermati dal birrificio? | **No, e non serve aspettare.** Usa `src/content/steps.it.ts` così com'è. |
| File audio? | **Non ci sono.** Task 8.25 è opzionale: lascia il toggle pronto, nessun file, documentalo. Non inventare suoni. |
| Cancellare i GLB morti in `public/3d/`? | **No.** Non hai l'autorizzazione. Lasciali e basta. |
| Destinazione di "DOVE TROVARLA"? | Ancora `#contatti`, già in `steps.it.ts`. |
| Etichetta a 4096 px? | **Non c'è.** Resta a 2008×827. |
| Vulnerabilità di `react-router-dom`? | **Non toccarle.** Preesistenti, decide il proprietario. |

## Fatti misurati, non li rimisurare

Numeri verificati su questo repo, non da fidarsi della spec dove diverge.

**GLB ottimizzato** — `public/models/crisi_economica.glb`, 320 KB, 23.757
vertici. Tre nodi, nomi assegnati da `scripts/optimize-glb.mjs`:

- `vetro` — 4.989 vertici, materiale `.001`
- `tappo` — 10.160 vertici dopo la semplificazione, materiale `Material.002`
- `etichetta` — 8.721 vertici, texture WebP 2008×827 (133 KB)

Ingombro `1,3050 × 4,1769 × 1,3080`. Asse della bottiglia: Y (PCA
`0, 0.9997, -0.023`, lo scarto è l'etichetta). Le misure della spec 3.2–3.4
sono coerenti con questo file: usale, ma verifica le fasce F1–F4 col debug
`?debug=bands` del task 8.10 e correggi in `src/config/bottle.ts` se sbagliano
(regola 10.1.7).

**Compressione meshopt.** Il file è compresso meshopt. `useGLTF` di drei ha
`useMeshopt = true` di default, quindi il decoder è già agganciato: non serve
fare nulla. Ha però anche `useDraco = true`, che punta a gstatic — il file non
ha Draco quindi non scarica niente, ma se vuoi essere pulito passa
`useGLTF(url, false)`.

**Scala non uniforme.** Dopo il `flatten()` il nodo `tappo` porta una scala
composta non uniforme (≈ `0.3467, 0.0416, 0.3467`). Non c'è rotazione, quindi
`decompose` regge. Ma il task 8.9 deve fare il bake come dice la spec 6.2
(`geometry.applyMatrix4(mesh.matrixWorld)` e trasformazione azzerata), o gli
shader che leggono `vObjPos.y` lavorano in spazi diversi fra le tre mesh.

## Trappole già pagate, non ricascarci

1. **`normals()` di gltf-transform spacchetta tutto il documento** e dà normali
   piatte. Se ti serve ricalcolare normali, usa `normaliLisce()` in
   `scripts/optimize-glb.mjs`.
2. **`meshopt()` vuole l'encoder registrato sull'IO**, non solo passato alla
   transform: `new NodeIO().registerDependencies({ 'meshopt.encoder': … })`.
   Senza, muore con `encodeFilterOct` undefined in fase di scrittura.
3. **`weld()` fonde solo vertici identici bit per bit.** Normali spezzate o UV
   inutili impediscono la saldatura e con essa la semplificazione.
4. **Niente browser su questa macchina, e niente `ffmpeg`.** Il video di
   riferimento non si può guardare: la fonte di verità è la sezione 2 della
   spec. Per il task 8.28 (Playwright) installa `@playwright/test` quando ci
   arrivi: se i browser non si scaricano, scrivi comunque lo script, lascialo
   nel repo, e dichiara nel commit che non è stato eseguito. Non bloccarti.
5. **Verifica headless del 3D** — è il modo in cui si lavora qui (vedi
   `CLAUDE.md`): si carica il GLB in Node con `GLTFLoader` e si esegue la
   logica vera. Il modello è in `scripts/verify-glb.mts`, con lo shim per il
   DOM mancante (`globalThis.self` e `TextureLoader.prototype.load` stubbati).
   Esegui con `node --experimental-strip-types`. Fallo per ogni pezzo di
   matematica non banale: `StateMapper`, `solvePivot`, le fasce dell'etichetta.
6. **I sorgenti vanno in `scripts/`, non nello scratchpad**: da fuori dal
   progetto gli import bare (`three`, `@gltf-transform/core`) non risolvono.
7. **Heredoc bash e apostrofi italiani non vanno d'accordo.** Per scrivere file
   con molto testo usa lo strumento di scrittura, non `cat <<EOF`.

## Com'è fatto il repo adesso

```
assets-src/Crisi_Economica_etichettata.glb   sorgente, non va in dist
public/models/crisi_economica.glb            ottimizzato, 320 KB
docs/URANIO_SCROLL_SPEC.md                   la spec
docs/AUDIT.md                                decisioni e correzioni alla spec
docs/CONTINUA.md                             questo file
scripts/optimize-glb.mjs                     npm run optimize:glb
scripts/verify-glb.mts                       npm run verify:glb
scripts/check-tokens.mjs                     gira dentro npm run build
src/config/theme.ts                          colori, durate, easing, soglie
src/styles/tokens.css                        gli stessi colori per il CSS
src/styles/text.css                          .t-display .t-body .t-label
src/content/steps.it.ts                      tutti i testi
src/hooks/useFontsReady.ts                   gate di document.fonts.ready
src/debug/TypeSpecimen.tsx                   ?debug=type
src/pages/Experience.tsx                     gli strati 4.2, ancora vuoti
```

**`src/config/theme.ts` è la fonte di verità dei colori.** Se ne aggiungi uno,
aggiungilo anche in `tokens.css` o `npm run build` fallisce: è
`scripts/check-tokens.mjs` che lo impone, di proposito.

**Niente numeri magici nel codice** (regola 10.1.4): colori, durate, easing,
keyframe e costanti della bottiglia stanno in `src/config/`.

## Scelte architetturali già prese, non rimetterle in discussione

- **Stack React, non vanilla.** Previsto dalla spec 4.1. I moduli `core/`
  (`Ticker`, `Viewport`, `StepController`, `Progress`, `StateMapper`) restano
  classi TypeScript pure **fuori da React**, così si testano in Node. Solo
  `gl/` e `ui/` diventano componenti R3F.
- **L'esperienza vive su `/esperienza`** finché non è finita. Al task 8.21 si
  trasferisce in `src/pages/Home.tsx` al posto dell'hero attuale, e la route
  sparisce (togli anche `esperienza` da `ROUTE` in `scripts/postbuild.mjs`).
- **La sezione "Chi siamo" (`src/components/about/`) non si tocca**, regola
  10.1.10. Diventa il contenuto sotto l'esperienza, raggiunto dal task 8.21.
  Carica `public/models/crisi_economica.glb` tramite `bottleAssembly.ts`: se
  cambi quel file o i nomi dei nodi, `npm run verify:glb` deve continuare a
  passare.
- **Il codice di debug è in import dinamico.** Senza `?debug` non deve finire
  nel bundle. Il modello è `src/debug/TypeSpecimen.tsx` in `Experience.tsx`.
- **Il preloader esistente si riusa**: `src/components/Loader.tsx` è già
  agganciato al progresso reale dei GLB via `src/lib/assetProgress.ts` e
  `useProgress` di drei. Non riscriverlo da zero al task 8.22, rivestilo.
- **Il menu esistente si riusa**: `src/components/TopBar.tsx` ha già la nav, il
  menu hamburger sotto 861 px e lo switch IT/EN. Al task 8.16 rifai il guscio
  come header HUD, non la logica del menu.

## Cosa resta non verificato a occhio

Su questa macchina non c'è un browser, quindi nessuno ha ancora guardato
niente. Tienine conto e **dillo nei commit**, non dichiarare "fatto" ciò che
hai solo compilato:

- pagina nera a tutto schermo senza barre (8.2);
- provino tipografico (8.3);
- **la zigrinatura del tappo dopo la semplificazione** (8.4): le normali ora
  sono lisce, l'ondulazione c'è ma la piega non è più netta. L'inviluppo della
  silhouette è stato misurato (3,38% → 3,76% su 180 spicchi, tutti coperti,
  quindi non poligona), ma è un numero, non un giudizio visivo. La manopola è
  `CAP_TARGET_VERTS` in `scripts/optimize-glb.mjs`.

Dove non puoi verificare, misura ciò che si può misurare in Node e scrivi
chiaramente nel commit cosa resta da guardare.

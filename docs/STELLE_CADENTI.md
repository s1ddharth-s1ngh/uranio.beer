# Stelle cadenti nel hero

Piano e diario del lavoro sullo sfondo della prima sezione (2026-11-17).
Richiesta del proprietario: uno sfondo di stelle che cadono, "molto
spazioso, molto illuminante, molto figo", a tema spazio, senza diecimila
colori. Il logo 3D (forma, materiale, come segue il mouse e come reagisce ai
calci) **non si tocca**.

## Vincoli

- Intoccabili: `UranioLogo.tsx`, `useLetterPhysics.ts`, `useWindowPointer.ts`,
  `pieceMask.ts`, `chromeMaterial.ts`, `heroParams.ts`, l'ambiente cromato,
  luci, camera, tone mapping del canvas e il markup del hero in `Home.tsx`.
- Le stelle cadenti vivono **dentro** il canvas del hero, dietro al logo. Un
  canvas 2D separato sotto non si vedrebbe (il canvas WebGL è opaco, `alpha:
  false`) e renderlo trasparente cambierebbe il look del cromo.
- Niente postprocessing (un bloom toccherebbe anche il logo): la luce delle
  meteore è disegnata nello shader.
- Componente autonomo e riusabile: la sezione 2 (sessione parallela) lo monta
  nel suo canvas, che gira con `frameloop="never"` e `advance()` a mano. Quindi
  niente camera, niente puntatore, niente timer propri: il tempo è la somma
  dei `delta` di `useFrame`.

## Direzione artistica

Il riferimento è una foto a lunga posa di uno sciame meteorico, non un
effetto da videogioco: nero profondo, linee sottilissime, luce vera.

- **Un solo colore.** Teste bianche; la scia, mentre si spegne, vira appena al
  freddo (lo stesso filo di blu che ha il cromo nei bui). Nessun'altra tinta.
- **Sciame con radiante.** Tutte le meteore partono da un punto fuori
  schermo in alto a destra e si aprono a ventaglio verso il basso a sinistra:
  parallele ma non tutte uguali, come in prospettiva. Danno profondità e
  puntano verso il titolo "ATOMIC BEER".
- **Magnitudini.** Tante meteore deboli e corte, poche brillanti e lunghe:
  è la distribuzione vera, ed è quella che fa "spazio" invece di "pioggia".
- **Scia persistente.** La scia non è un segmento che segue la testa: ogni
  punto si accende quando la testa ci passa e si spegne col suo tempo. Così
  la scia è sottile all'innesco, piena a metà, e resta un attimo nel cielo
  dopo che la testa si è consumata.
- **Il bolide.** Ogni 15 secondi circa ne passa uno grande e lento che a fine
  corsa fa un lampo con le quattro punte (✦). È il momento "figo", raro di
  proposito.
- **Spazio, non traffico.** In media una meteora visibile alla volta, mai
  davanti al logo (il logo le copre: passano dietro), di preferenza ai lati.
- **Cielo vivo.** Il campo stellare che c'è già resta com'è, con un
  luccichio lento su una parte delle stelle.

## Come funziona

`src/components/scene/FallingStars.tsx`, un solo draw call.

1. Una `InstancedBufferGeometry` con due quad per meteora (scia e testa) e un
   attributo per istanza: il seme e il tipo (normale o bolide).
2. Ogni istanza è uno "slot" che si ripete con un periodo suo. Il ciclo
   corrente (`floor(tempo / periodo)`) entra in un hash: ogni ciclo è una
   meteora nuova (posizione, magnitudine, velocità, durata), alcuni cicli
   restano vuoti. Tutto nel vertex shader: in JavaScript per frame si
   aggiornano solo due uniform, nessun buffer.
3. Le meteore sono disegnate in **spazio schermo** (px CSS), quindi spessori
   e aloni sono in pixel veri a qualunque risoluzione e non dipendono dalla
   camera; la profondità è quella del piano lontano, così il logo le copre.
4. Fragment: scia gaussiana che si assottiglia invecchiando + un alone largo
   e debole; testa con nucleo, alone esponenziale e punte del lampo. Spessori
   sotto il pixel allargati conservando l'energia (niente sfarfallio), bordi
   dei quad sfumati a zero (la conversione sRGB renderebbe visibile anche un
   residuo dello 0,5%). Colori in lineare con `colorspace_fragment`.
5. Fusione additiva premoltiplicata, `depthWrite` spento: l'ordine con il
   campo stellare non conta.
6. Densità scalata con lo `starFactor` di `HeroScene` (mobile 0,55, tablet
   0,8). Con `prefers-reduced-motion` non viene montato.

## Fasi

1. Componente `FallingStars` e montaggio in `HeroScene` (una riga).
2. Luccichio del campo stellare (`Starfield.tsx`, patch del `PointsMaterial`
   con `onBeforeCompile`: stessa sprite, stessa attenuazione, stesso tone
   mapping).
3. Verifica visiva con Playwright su GPU vera (ANGLE D3D11), build di
   produzione, `page.clock` per fermare il tempo: fotogrammi singoli e una
   "lunga posa" (massimo per pixel su qualche secondo) per vedere ventaglio,
   distribuzione e densità. Formati 1440×900, 390×844, 768×1024.
4. Taratura: densità, lunghezze, luminosità, radiante.
5. Costo GPU prima e dopo (svuotamento con `readPixels`, mediana di tre
   finestre), `npx tsc -b`, `npx eslint src`.
6. Commit per path esplicito, messaggio alla sessione della sezione 2.

## Criteri di accettazione

- Logo, fisica, puntatore: nessun file toccato, nessuna differenza di
  comportamento.
- Le meteore non passano mai davanti al logo e non escono dal tema: bianco
  e un accenno di freddo.
- In media non più di una o due meteore visibili insieme su desktop.
- Costo aggiunto sotto il mezzo millisecondo per frame a 1440×900.
- Con reduced motion: nessuna meteora, nessun luccichio.

## Esito

Fatto tutto il piano. File toccati: `FallingStars.tsx` (nuovo),
`HeroScene.tsx` (una riga), `Starfield.tsx` (luccichio). Logo, fisica,
puntatore, materiale e ambiente: nessuna modifica.

**Taratura finale**, arrivata in quattro giri di riprese:

1. Primo giro, magnitudini `m^2.4`: a schermo intero si leggevano solo le
   meteore brillanti, le altre erano fili grigi. Ora `m^1.7`, luce minima
   0,5, scie più lunghe (tau 0,12-0,32 s) e le deboli corrono più piano
   delle brillanti: è quello che dà la profondità.
2. Densità: 7 slot + il bolide, il 35% dei giri vuoti. Circa 0,8 meteore al
   secondo; nelle riprese di 16 s ci sono fotogrammi senza meteore, ed è
   giusto così.
3. Il bolide cadeva a caso e una volta ha fatto il lampo dietro la "O". Ora
   ha una corsa fissa (0,3 diagonali) e fino a otto tentativi per una corsa
   tutta fuori dal logo, con il lampo dentro lo schermo. Nelle riprese torna
   ogni 9 s esatti, sempre visibile.
4. Al lampo la scia mostrava un taglio dritto sulla testa e l'alone faceva
   nebbia. Ora la scia finisce con un cappuccio tondo e il lampo gonfia il
   nucleo e accende le punte, mentre l'alone cresce poco.

**Verifiche** (build di produzione su una copia pulita di HEAD più questi
tre file, Playwright con ANGLE D3D11, tempo fermato con `page.clock`):

- 1440×900, 390×844, 768×1024: ventaglio dal radiante, meteore dietro al
  logo (anche dentro l'anello), il bolide con il lampo e le punte. Sul
  telefono le corse sono più verticali, come previsto dal radiante.
- Costo: confrontare build diverse non serve, tra un caricamento e l'altro la
  iGPU balla di 5-8 ms. Misurato nella stessa pagina disegnando le meteore
  41 volte per frame: **0,048 ms per frame a 2850×1800** (DPR 2), 0,015 ms a
  1425×900.
- Reduced motion: zero draw delle meteore, nessun errore in console.
- `tsc -b`, `eslint src`, `vite build`: puliti sulla copia pulita. Sul
  working tree condiviso `tsc` fallisce in `src/gl`, `src/config` e
  `src/debug` per il lavoro in corso della sessione della sezione 2, non per
  questi file.
- L'avviso `X4122` del compilatore HLSL in console c'era già prima: non
  viene da questi shader.

**Riuso.** La sezione 2 importa `Starfield` (stessa API di prima: default
export, `reduceMotion`, `factor`) e monta anche `FallingStars` nel suo
canvas: `factor` è l'unica prop. In un canvas trasparente la fusione
premoltiplicata aggiunge luce e alfa insieme, quindi le meteore restano luce
sopra quello che c'è sotto.

**Non verificato**: dispositivi veri (Safari iOS, Android), schermi a 120 Hz
(il tempo viene dal delta, quindi la velocità non cambia), il luccichio in
movimento (solo fotogrammi fermi).

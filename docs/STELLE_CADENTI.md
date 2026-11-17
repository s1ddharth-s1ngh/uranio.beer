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


## Secondo giro: il sogno spaziale

Il proprietario: le stelle cadenti sono belle, ma restano un effetto
"normale", il cielo visto dalla Terra. Vuole qualcosa che dica che siamo
fuori da questo pianeta, un sogno spaziale vivido, sempre senza diecimila
colori, e un'animazione migliore.

**L'idea.** Uranio è l'elemento naturale più pesante: nel sogno il logo
pesa così tanto da piegare lo spazio. È una lente gravitazionale, la cosa
che dalla Terra non si vede e che tutti conoscono da Interstellar e dalla
foto del buco nero di M87: la luce di ciò che sta dietro gli si avvolge
attorno. Le stelle cadenti restano.

**Com'è fatto** (`DeepSpace.tsx`, al posto dello `Starfield` nel hero;
`Starfield.tsx` resta per la sezione 2, che lo usa):

1. *L'anello.* Il nucleo di una galassia lontana, quasi esattamente dietro
   al logo, si apre in un anello di Einstein sottile appena fuori dalla
   sagoma del logo, con un lato tre volte più acceso che gira piano (un
   giro in due minuti). Dietro a una lente un nucleo così si vede solo come
   anello, quindi si disegna solo una corona attorno al logo, in modo
   analitico: equazione della lente all'indietro più una gaussiana. Lungo
   la curva critica l'anello è acceso un poco di più, come l'anello di
   fotoni di un buco nero: licenza poetica.
2. *Le stelle.* Derivano piano verso il basso a sinistra, la direzione
   delle stelle cadenti, su tre strati di parallasse. Passando vicino al
   logo gli scivolano attorno, si sdoppiano e si stirano ad arco: la lente
   (puntiforme, `s = θ(1 − E²/|θ|²)`) è calcolata per pixel e all'indietro,
   dal punto dello schermo a dove starebbe la luce senza la massa, così gli
   archi vengono curvi da soli. Ogni immagine è disegnata in una striscia ad
   arco di otto spicchi che la contiene. Densità per area: 260 stelle per
   megapixel del quadrato in cui derivano, uguale su telefono e desktop.
3. *Le comete.* Due slot (16 e 27 s) di comete che passano proprio dietro
   al logo, a distanze diverse dall'asse: la lente le apre in due archi che
   corrono lungo l'anello e, più passano allineate, più lo chiudono. È la
   fisica esatta di una sorgente in moto dietro una massa, nello stesso
   shader delle stelle. La prima passa due secondi e mezzo dopo l'avvio.
4. Il nucleo e le comete sono piegati 1,16 volte più delle stelle (la
   deviazione cresce con la distanza della sorgente): il loro anello sta
   fuori dalla sagoma del logo, mentre le stelle lontane dal logo restano
   puntini. In portrait il raggio è un po' più largo (0,36 invece di 0,33
   del lato corto), perché il logo occupa quasi tutta la larghezza.
5. Sotto il menu l'anello si spegne (le voci restano leggibili), e un
   livello di dither evita i gradini nelle sfumature su fondo nero.
6. Reduced motion: cielo e anello fermi, niente comete, niente meteore.

**Come ci si è arrivati**, riprese dopo riprese:

1. Primo tentativo: volo in avanti tra le stelle, che uscivano dal logo,
   con la lente sulle stelle. Le stelle erano invisibili (conservavo
   l'energia da una dimensione nominale di 0,25 px). Con raggio 0,4 tutto
   il cielo diventava trattini, le immagini interne facevano un pulviscolo
   che sfarfallava, le stelle vicine sfocate sembravano macchie sull'obiettivo.
2. Con le sole stelle la lente si vedeva poco: un punto diventa un arco
   solo quando passa proprio dietro. Le immagini famose funzionano perché
   dietro c'è una sorgente estesa: aggiunta una Via Lattea (fascia e nucleo)
   da piegare ad anello.
3. Un parere indipendente sui fotogrammi (un agente senza le mie
   conclusioni) è stato netto. Il volo in avanti era il cliché del salvaschermo
   e contraddiceva il buco nero, perché dal buco nero le stelle non escono.
   La fascia faceva smog: la mediana del frame era salita da 5 a 22 su 255.
   L'anello era largo e fumoso, il respiro periodico sembrava
   un'animazione di interfaccia, non c'era dither, e menu e scritta
   perdevano contrasto. Corretto tutto: deriva al posto del volo, comete
   lensate al posto del respiro, anello sottile dal nucleo, niente fascia,
   dither, sfumatura sotto il menu.
4. Costo: la galassia a schermo intero costava 2,9 ms a 2850×1800 su
   questa GPU integrata, perché bisogna leggere e riscrivere ogni pixel.
   Calcolarla in un bersaglio a bassa risoluzione non bastava: il solo
   passaggio opaco per posarla costava circa 2,2 ms. Il nucleo dietro la
   lente si vede solo come anello, quindi si disegna solo la corona.

**Verifiche** (build di produzione, Playwright con ANGLE D3D11 sulla GPU
integrata, tempo fermato con `page.clock`):

- 1440×900: l'anello sottile (10-12 px a metà altezza) con il lato acceso
  2,5 volte l'altro; una cometa ripresa per intero mentre la lente la piega
  lungo il bordo superiore, la apre in un arco sul lato sinistro, la
  sdoppia sui due lati e la lascia riemergere in basso a sinistra.
- 390×844 a DPR 2 e 768×1024: l'anello resta una ventina di px fuori dalla
  sagoma del logo, le stelle restano rade.
- Il profilo dell'anello rifatto in JavaScript: sul bordo della corona la
  luce è 0,36/255, quindi non c'è un taglio visibile.
- Reduced motion: cielo e anello fermi, niente comete né meteore, nessun
  errore in console.
- Costo, misurato nella stessa pagina ridisegnando 21 volte: l'anello
  0,21 ms a 2850×1800 e 0,05 ms a 1425×900; stelle, comete e meteore
  insieme 0,30 ms a 2850×1800.
- `tsc -b`, `eslint src` e `vite build` puliti su tutto il progetto.

**Non verificato**: dispositivi veri (Safari iOS, Android) e la resa in
movimento a 60 fps, vista solo a fotogrammi fermi.

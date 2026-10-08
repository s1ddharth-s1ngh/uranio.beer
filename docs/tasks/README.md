# Task 8.19 – 8.28, un file per task

Ogni file di questa cartella è il brief completo di un task: lo si dà a una
sessione **nuova** di Claude Code ("Leggi `docs/tasks/8.19-hero.md` ed
eseguilo") che riparte pulita, con solo il contesto che le serve. Si possono
eseguire in sequenza oppure, ondata per ondata, in parallelo.

Il contesto comune (architettura, fatti misurati, trappole, risposte di
default) **non** è ripetuto nei brief: sta in `docs/CONTINUA.md`, che ogni
sessione legge per primo.

> **Cambio di direzione del 2026-10-08.** Il hero originale della home resta
> la prima sezione, intatto; l'esperienza è la seconda, con un passaggio
> animato fra le due (`lib/pageScroll.ts`). Dove un brief dice che
> l'esperienza sta "in cima alla home" o "al posto del hero", vale questo.
> Dettagli in `docs/CONTINUA.md`, sezione "Cambio di direzione".

## Stato al 2026-10-08

- Fasi A, B e C finite; fase D fino al 8.18 compreso.
- Il 8.18 (testi degli step) è nello storico come `41d7894 autocommit …`: il
  commit col messaggio giusto era mancato e non si riscrive la storia. È stato
  verificato il 2026-10-08: `tsc -b`, `eslint src`, `npm run build`,
  `verify:core` e `verify:glb` escono tutti 0. Nessuno l'ha visto in un
  browser.
- `node_modules` mancava: si reinstalla con `npm ci`, **una volta per
  cartella** e mai da due sessioni insieme nella stessa cartella.

## Le ondate

| ondata | brief | dipende da |
| --- | --- | --- |
| 1 | [8.19 interfaccia dell'hero](8.19-hero.md) | — |
| 1 | [8.20 finale](8.20-finale.md) | — |
| 1 | [8.21 uscita verso il resto della pagina](8.21-uscita.md) | — |
| 1 | [8.25 audio, solo documentazione](8.25-audio.md) | — |
| 1 | [8.26 birra dentro la bottiglia](8.26-birra.md) | — |
| 2 | [8.22 preloader e ingresso](8.22-preloader.md) | 8.19, 8.21 |
| 2 | [8.23 responsive](8.23-responsive.md) | 8.19, 8.20, 8.21 |
| 2 | [8.27 performance](8.27-performance.md) | 8.21 |
| 3 | [8.24 accessibilità e fallback](8.24-accessibilita.md) | tutta l'interfaccia |
| 4 | [8.28 QA finale e documentazione](8.28-qa.md) | tutto |

Dentro un'ondata i task toccano file diversi, con due eccezioni previste:
8.19, 8.20 e 8.21 montano o spostano cose nello stesso
`src/pages/Experience.tsx`, e quasi tutti aggiungono un blocco a
`scripts/verify-core.mts`. Sono conflitti di poche righe, si risolvono a mano.

In sequenza l'ordine è quello della tabella: 8.19, 8.20, 8.21, 8.25, 8.26,
8.22, 8.23, 8.27, 8.24, 8.28.

## Lavorare in parallelo: mai nella stessa cartella

Tre sessioni nella stessa cartella si rompono il lavoro a vicenda:

1. l'hook `Stop` di `~/.claude/settings.json` fa `git add -A` e committa a
   fine turno: in una cartella condivisa si porta via anche il lavoro a metà
   delle altre sessioni;
2. `tsc -b`, `eslint src` e `npm run build` controllano tutto il progetto: il
   codice a metà di una sessione fa fallire le verifiche delle altre;
3. `npm run build` riscrive `dist/`, e due build insieme si pestano.

Quindi una cartella per sessione, con `git worktree`. **Richiede un branch per
worktree, e `CLAUDE.md` dice "si resta su `main`, nessun branch": lo decide il
proprietario del repo.** Se la risposta è no, si va in sequenza: i brief
servono lo stesso, perché ogni sessione parte pulita.

```sh
# dal repo principale, su main, una volta per task dell'ondata
git worktree add ../uranio-8.19 -b task/8.19
cd ../uranio-8.19 && npm ci
# … la sessione di Claude Code lavora lì dentro …

# a ondata finita, dal repo principale su main: storia lineare,
# un task = un commit
git cherry-pick main..task/8.19
# (conflitti attesi solo su Experience.tsx e verify-core.mts)
npx tsc -b; npx eslint src; npm run build; npm run verify:core; npm run verify:glb
# solo dopo aver visto i commit su main: `-D` perché dopo un cherry-pick git
# non riconosce il branch come unito
git worktree remove ../uranio-8.19 && git branch -D task/8.19
```

L'ondata successiva parte da `main` aggiornato. Una sessione che si trova in
un worktree su `task/8.xx` **resta su quel branch**: l'ha creato il
proprietario per lavorare in parallelo, non deve fare checkout di `main`.

## Regole comuni a tutti i brief

1. **Leggi `docs/CONTINUA.md` prima di tutto**, poi le sezioni della spec che
   il brief indica. Non fare domande: ogni dubbio ha un default nel brief o in
   CONTINUA; se non c'è, scegli tu e scrivilo nella sezione **Esito**.
2. Se `node_modules` non c'è: `npm ci`.
3. Prima del commit, guardando l'esito di **ognuno** con `echo $?` e mai con
   un `grep` (trappola 8):

   ```sh
   npx tsc -b; echo $?
   npx eslint src; echo $?
   npm run build; echo $?
   npm run verify:core; echo $?
   npm run verify:glb; echo $?
   ```

4. Un task = un commit, col messaggio indicato nel brief, in italiano. Niente
   `push`, niente `--amend`. **Aggiungi i file per nome** (`git add percorso
   …`), mai `git add -A`: in una cartella condivisa ti porteresti dietro il
   lavoro altrui.
5. Le note (scelte prese, scostamenti dalla spec, numeri da guardare a occhio)
   vanno nella sezione **Esito** in fondo al **tuo** brief e non in
   `docs/AUDIT.md`: così sessioni parallele non si contendono lo stesso file.
   Il 8.28 le riporta tutte in `AUDIT.md`.
6. In `scripts/verify-core.mts` aggiungi il tuo blocco `{ … }` accanto al
   blocco più affine, non in coda subito prima di `verify-core: OK`: se tutti
   scrivono nello stesso punto, ogni cherry-pick diventa un conflitto.
7. Nessun browser su questa macchina: misura in Node quello che si può
   misurare e scrivi nel commit cosa resta da guardare.

## Dopo il 8.28

Il resoconto finale che chiede `docs/CONTINUA.md`: cosa è stato fatto, cosa
resta non verificabile, le domande aperte per il birrificio.

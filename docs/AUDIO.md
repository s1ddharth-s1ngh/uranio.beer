# Audio

Il pulsante AUDIO dell'header c'è già, i suoni no. Questo file dice quali
file servono, dove vanno e come si collegano quando arrivano (spec §8.25).

## Stato attuale

- Toggle: `src/hooks/useAudioEnabled.ts`, usato solo da `src/ui/Hud.tsx`.
  Chiave `localStorage` `uranio:audio`, valori `"1"` / `"0"`, **spento di
  default**. Le barrette dell'header oscillano solo ad audio acceso.
- Nessun file audio nel repo e nessun codice che riproduca suoni: il criterio
  "non parte mai suono senza un click" è vero perché di suono non ne parte
  nessuno.
- Niente file vuoti in `public/`: finirebbero nel sito pubblicato.
- La domanda per il birrificio è in `docs/AUDIT.md` ("Audio: file del
  birrificio o via libera a suoni con licenza libera").

## I tre file attesi

Cartella `public/audio/`, formato **mp3** (lo leggono tutti i browser),
mono va bene, 128 kbps bastano.

| file | cos'è | durata indicativa | loop | volume relativo |
| --- | --- | --- | --- | --- |
| `tappeto.mp3` | tappeto sonoro leggero, ambiente | 30–60 s, chiusura raccordata all'inizio | sì | 0,25 |
| `stappo.mp3` | stappo di una bottiglia di birra | < 1 s | no | 0,4 |
| `tintinnio.mp3` | tintinnio di vetro leggero | < 1 s | no | 0,3 |

Volumi tutti bassi: è un sito da leggere, l'audio accompagna. I numeri sono un
punto di partenza da tarare a orecchio.

**Licenza:** file del birrificio, oppure con licenza libera (CC0, o CC BY con
attribuzione). Se serve un'attribuzione, va in fondo alla home (oggi non c'è
un footer: basta un `<small>` in coda a `src/pages/Home.tsx`), non nell'HUD
della scena.

## Quando suonano

- **Tappeto:** parte quando l'utente accende il toggle, mai prima. L'autoplay
  è bloccato dai browser e la regola è comunque "mai suono senza un click".
  Chi trova `uranio:audio = "1"` al ricaricamento sente il tappeto solo dopo la
  prima interazione con la pagina: il `play()` che fallisce si ignora e si
  riprova al primo `pointerdown` / `keydown`.
- **Stappo:** allo `step:leave` con `from === 0` e `to > 0`. La spec dice
  "passaggio 0 → 1", ma le icone saltano anche da 0 a 3: lo stappo è
  l'uscita dalla copertina, non lo step 1 in sé.
- **Tintinnio:** a ogni `step:enter`, **tranne** il primo dispatch di
  `Progress.jump()` all'avvio da `#step-N` (non è una scelta dell'utente).
- **Dissolvenze:** 0,3 s in entrata e in uscita sul tappeto, e allo spegnimento
  del toggle. Gli effetti brevi non ne hanno bisogno.
- **Tab nascosta:** tutto fermo (`visibilitychange`), il tappeto riprende con
  la dissolvenza quando la tab torna visibile e il toggle è ancora acceso.
- **`prefers-reduced-motion`:** non riguarda l'audio, nessun cambiamento.

## Come si collegano

Un modulo `src/core/Audio.ts`, ~40 righe, TypeScript fuori da React come il
resto di `core/`:

- tre `HTMLAudioElement` creati pigramente alla prima accensione (prima nessun
  download); `loop = true` sul tappeto. Web Audio (`GainNode` con
  `linearRampToValueAtTime`) solo se le dissolvenze con `element.volume` si
  sentono a scatti: su iOS `volume` è in sola lettura, quindi lì serve Web
  Audio comunque oppure si rinuncia alla dissolvenza.
- ascolta `sharedProgress()` (`step:leave`, `step:enter`, vedi
  `src/core/Progress.ts`) e `document` per `visibilitychange`;
- espone `setEnabled(on: boolean)`. Lo stato vive nel hook, che oggi tiene uno
  `useState` locale a `Hud`: `Hud` chiama `setEnabled(audio)` in un
  `useEffect`. Il modulo non rilegge `localStorage` per conto suo, così la
  fonte di verità resta una.
- volumi e durata delle dissolvenze in `src/config/` (in `theme.ts` accanto
  alle altre durate, o un `audio.ts` se diventano più di quattro numeri),
  regola 10.1.4: nessun numero magico nel modulo.

Verifica senza browser: in `scripts/verify-core.mts` si può controllare la
logica degli eventi (stappo solo con `from === 0`, nessun tintinnio dal
`jump()` iniziale) con un finto `HTMLAudioElement` che conta i `play()`.

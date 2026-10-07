import { useEffect, useState } from "react";

/**
 * `true` quando i font sono caricati davvero.
 *
 * Serve a non far partire nessuna animazione di testo prima: `SplitText` (e
 * qualunque misura di righe) legge la geometria del testo nel momento in cui
 * gira, e se lo fa mentre è ancora in carico il font di ripiego, le righe si
 * spezzano dove capita e restano spezzate lì anche dopo lo swap.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.status === "loaded");

  useEffect(() => {
    if (ready) return;
    let vivo = true;
    document.fonts.ready.then(() => {
      if (vivo) setReady(true);
    });
    return () => {
      vivo = false;
    };
  }, [ready]);

  return ready;
}

import { useCallback, useState } from "react";

const KEY = "uranio:audio";

/**
 * Lo stato del pulsante AUDIO dell'header (spec 8.16, suoni al task 8.25).
 *
 * Spento di default e ricordato in `localStorage`: i browser bloccano
 * l'autoplay, quindi il suono non può partire senza un click comunque — ma
 * chi l'ha acceso una volta non deve rifarlo a ogni pagina.
 */
export function useAudioEnabled(): [boolean, () => void] {
  // Inizializzatore pigro: `localStorage` si legge una volta, al primo
  // render, non a ogni render e non dentro un effetto (che costerebbe un
  // secondo render e un lampo di stato sbagliato).
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      // modalità privata o storage negato: si resta spenti
      return false;
    }
  });

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // niente da fare: lo stato vale per questa sessione
      }
      return next;
    });
  }, []);

  return [on, toggle];
}

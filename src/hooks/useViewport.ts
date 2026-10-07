import { useEffect, useState } from "react";
import { Viewport, type ViewportState } from "../core/Viewport";

/**
 * Un solo `Viewport` per tutta la pagina: gli ascoltatori di resize sono due e
 * misurare la finestra una volta per componente non ha senso.
 */
let shared: Viewport | undefined;

export function sharedViewport(): Viewport {
  shared ??= new Viewport();
  return shared;
}

/** Lo stato del viewport, aggiornato dopo il debounce di 100 ms. */
export function useViewport(): ViewportState {
  const vp = sharedViewport();
  const [state, setState] = useState(vp.state);
  useEffect(() => vp.subscribe(setState), [vp]);
  return state;
}

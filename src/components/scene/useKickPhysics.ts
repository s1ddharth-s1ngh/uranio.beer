import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PointerState } from "./useWindowPointer";

// Fisica del "calcio" estratta dal vecchio KickModel: tre regimi (inclinazione
// dolce su hover, spinta di posizione + spin su swipe veloce) con rientro
// elastico. Indipendente dal framerate. Riusata per OGNI pezzo del logo Uranio
// (le 6 lettere + l'emblema), così ogni carattere è calciabile per conto suo.

export interface KickTuning {
  // area d'influenza / soglia tra i regimi
  radius?: number; // raggio d'azione in NDC corretto per l'aspect
  fastThreshold?: number; // velocità puntatore (NDC/s) oltre cui scatta il calcio
  // intensità dei tre regimi
  gentleTilt?: number; // inclinazione dolce su hover lento
  kickPos?: number; // spinta di POSIZIONE su swipe veloce
  kickSpin?: number; // spin base su swipe veloce
  edgeSpin?: number; // spin EXTRA su colpo fuori centro (il "360")
  // rientro elastico
  posK?: number; // rigidità molla posizione
  posDamp?: number; // smorzamento posizione
  rotK?: number; // rigidità molla rotazione
  rotDamp?: number; // smorzamento rotazione
  // deriva ambientale su touch (ampiezze: le lettere del logo sono vicine,
  // servono valori piccoli perché la parola resti leggibile)
  ambientPos?: number;
  ambientRot?: number;
}

// NESSUN limite di distanza/rotazione: l'utente può calciare i pezzi dove
// vuole (volano anche fuori schermo) — la molla elastica li riporta comunque
// al posto. Restano solo dei tetti di VELOCITÀ, larghi, come pura sicurezza
// numerica (evitano NaN/esplosioni da un singolo impulso enorme), non come
// "regola di gioco". Prima c'erano MAX_OFFSET=1.6 e MAX_SPIN che tagliavano
// il volo: rimossi su richiesta.
const MAX_VEL_P = 32;
const MAX_VEL_R = 44;
// clamp della velocità del puntatore in unità/SECONDO (indipendente dal
// refresh rate): serve solo a non far "sparare" un pezzo quando il cursore
// rientra di colpo nel viewport (alt-tab); alzato per permettere flick forti
const MAX_POINTER_SPEED_PER_SEC = 16;

// Registro di debug (solo dev): magnitudo di offset/spin/tilt per pezzo,
// leggibile da console o dai test e2e come window.__kickDebug
const kickDebug: Record<
  string,
  { offset: number; spin: number; tilt: number }
> = {};
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__kickDebug = kickDebug;
}

interface KickPhysicsArgs {
  group: RefObject<THREE.Group | null>;
  restPos: [number, number, number]; // posa di riposo (posizione)
  restRot: [number, number, number]; // posa di riposo (rotazione)
  // raggio del bounding sphere del pezzo: l'impulso di posizione scala con la
  // taglia così un colpo sposta "circa mezzo carattere" a prescindere dal pezzo
  sizeFactor: number;
  pointer: RefObject<PointerState>;
  reduceMotion?: boolean;
  ambient?: boolean; // touch: niente calcio, deriva ambientale lenta
  debugId: string;
  tuning?: KickTuning;
}

export function useKickPhysics({
  group,
  restPos,
  restRot,
  sizeFactor,
  pointer,
  reduceMotion = false,
  ambient = false,
  debugId,
  tuning,
}: KickPhysicsArgs): void {
  const {
    radius = 0.55,
    fastThreshold = 0.72, // NDC/s (= 0.012 NDC/frame a 60Hz)
    gentleTilt = 0.5,
    // la traslazione era impercettibile (impulso in unità mondo troppo piccolo
    // rispetto ai radianti dello spin) → kickPos alto e molla posizione morbida:
    // vola fuori e rientra in ~0.6-1s
    kickPos = 30,
    // kickSpin/edgeSpin alti e molla rotazione morbida: un colpo secco sul bordo
    // arriva al giro completo ("360")
    kickSpin = 7,
    edgeSpin = 26,
    posK = 4.2,
    posDamp = 2.4,
    rotK = 3.2,
    rotDamp = 2,
    ambientPos = 0.08,
    ambientRot = 0.14,
  } = tuning ?? {};

  // Stato fisico = offset dalla posa di RIPOSO (a riposo tutto è 0 → fermo).
  // Tutti i vettori sono allocati una volta sola (mai `new` dentro useFrame)
  const offP = useRef(new THREE.Vector3()); // offset posizione
  const velP = useRef(new THREE.Vector3());
  const offR = useRef(new THREE.Vector3()); // spin accumulato
  const velR = useRef(new THREE.Vector3());
  const tilt = useRef(new THREE.Vector2()); // inclinazione dolce (lerp)
  const prevPointer = useRef(new THREE.Vector2());
  const hasPrev = useRef(false);
  const screen = useRef(new THREE.Vector3());
  // seed di fase per la deriva ambientale: distinto per pezzo
  const seed = useMemo(
    () => restPos[0] * 1.7 + restPos[1] * 0.9 + restPos[2] * 0.5,
    [restPos],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    // TOUCH: deriva ambientale lenta ATTORNO alla posa di riposo (i pezzi
    // "respirano" ma la composizione resta leggibile); ogni pezzo è sfasato
    // dal seed. Il dito resta libero di scrollare: niente fisica del calcio
    if (ambient && !reduceMotion) {
      const t = state.clock.elapsedTime;
      g.position.set(
        restPos[0],
        restPos[1] + Math.sin(t * 0.5 + seed) * ambientPos,
        restPos[2],
      );
      g.rotation.set(
        restRot[0] + Math.cos(t * 0.25 + seed) * ambientRot * 0.7,
        restRot[1] + Math.sin(t * 0.3 + seed) * ambientRot,
        restRot[2] + Math.sin(t * 0.2 + seed) * ambientRot * 0.4,
      );
      return;
    }

    const dt = Math.min(delta, 0.033); // stabile a qualsiasi framerate
    const p = pointer.current;

    // target dell'inclinazione dolce (default 0 = si rilassa)
    let tiltTX = 0;
    let tiltTY = 0;

    if (!reduceMotion && p.active) {
      // spostamento del puntatore nel frame in NDC corretto per l'aspect
      // (zona d'influenza circolare a schermo, direzioni coerenti col visivo),
      // clampato in unità/secondo così da essere identico a ogni framerate
      const aspect = state.size.width / state.size.height;
      let mvx = 0;
      let mvy = 0;
      let move = 0;
      if (hasPrev.current) {
        mvx = (p.x - prevPointer.current.x) * aspect;
        mvy = p.y - prevPointer.current.y;
        const raw = Math.hypot(mvx, mvy);
        const cap = MAX_POINTER_SPEED_PER_SEC * dt;
        if (raw > cap) {
          const s = cap / raw;
          mvx *= s;
          mvy *= s;
          move = cap;
        } else {
          move = raw;
        }
      }
      prevPointer.current.set(p.x, p.y);
      hasPrev.current = true;

      // centro del pezzo proiettato in NDC → vettore dal centro al cursore
      screen.current.setFromMatrixPosition(g.matrixWorld).project(state.camera);
      const dx = (p.x - screen.current.x) * aspect;
      const dy = p.y - screen.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist < radius) {
        const falloff = 1 - dist / radius; // 1 al centro, 0 al bordo

        // (1) INCLINAZIONE DOLCE: reagisce alla posizione del cursore anche
        // da fermo/lento, nessuno spostamento di posizione
        tiltTX = dy * falloff * gentleTilt;
        tiltTY = dx * falloff * gentleTilt;

        // (2)+(3) CALCIO solo se il mouse è abbastanza veloce: l'impulso usa
        // l'ECCESSO di spostamento del frame sopra soglia (integrale di
        // cammino → indipendente dal framerate)
        const hit = move - fastThreshold * dt;
        if (hit > 0) {
          const inv = move || 1;
          const dirX = mvx / inv; // direzione della "sberla"
          const dirY = mvy / inv;

          // (2) spinta di POSIZIONE lungo la direzione del mouse, scalata
          // sulla taglia del pezzo (un colpo sposta ~mezzo carattere sempre)
          const push = hit * kickPos * sizeFactor * (0.4 + 0.6 * falloff);
          velP.current.x += dirX * push;
          velP.current.y += dirY * push;
          velP.current.z += (Math.random() - 0.5) * push * 0.25;

          // (3) TORQUE fuori centro → il "360" quando colpisci di taglio:
          // braccio di leva × forza; grande al bordo, nullo al centro
          const lever = dist / radius;
          const crossZ = dx * dirY - dy * dirX;
          velR.current.z += crossZ * hit * (kickSpin + edgeSpin * lever);
          // ribaltamento 3D attorno all'asse perpendicolare alla sberla
          velR.current.x += -dirY * hit * kickSpin * (0.5 + lever);
          velR.current.y += dirX * hit * kickSpin * (0.5 + lever);
        }
      }
    } else {
      hasPrev.current = false;
    }

    // inclinazione dolce → lerp verso il target (o verso 0 = relax)
    const k = Math.min(1, 6 * dt);
    tilt.current.x += (tiltTX - tilt.current.x) * k;
    tilt.current.y += (tiltTY - tilt.current.y) * k;

    // molla POSIZIONE: offP → 0 (sotto-smorzata: rimbalza un po'). Nessun
    // clamp sull'offset: il pezzo può volare quanto vuole, la molla lo riporta
    velP.current.addScaledVector(offP.current, -posK * dt);
    velP.current.multiplyScalar(Math.max(0, 1 - posDamp * dt));
    velP.current.clampLength(0, MAX_VEL_P); // solo sicurezza numerica
    offP.current.addScaledVector(velP.current, dt);

    // molla ROTAZIONE: offR → 0 (nessun clamp: gira liberamente)
    velR.current.addScaledVector(offR.current, -rotK * dt);
    velR.current.multiplyScalar(Math.max(0, 1 - rotDamp * dt));
    velR.current.clampLength(0, MAX_VEL_R); // solo sicurezza numerica
    offR.current.addScaledVector(velR.current, dt);

    if (import.meta.env.DEV) {
      kickDebug[debugId] = {
        offset: offP.current.length(),
        spin: offR.current.length(),
        tilt: tilt.current.length(),
      };
    }

    // COMPOSIZIONE finale = RIPOSO FERMO + fisica + inclinazione dolce
    // (nessun idle float: a riposo il pezzo è immobile)
    g.position.set(
      restPos[0] + offP.current.x,
      restPos[1] + offP.current.y,
      restPos[2] + offP.current.z,
    );
    g.rotation.set(
      restRot[0] + offR.current.x + tilt.current.x,
      restRot[1] + offR.current.y + tilt.current.y,
      restRot[2] + offR.current.z,
    );
  });
}

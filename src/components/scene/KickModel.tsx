import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { PointerState } from "./useWindowPointer";

interface KickModelProps {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number]; // orientamento di riposo
  size?: number; // dimensione massima nel mondo (il modello viene normalizzato)
  pointer: RefObject<PointerState>;
  reduceMotion?: boolean;
  // touch: la fisica del calcio è mouse-only → deriva ambientale lenta
  ambient?: boolean;

  // area d'influenza / soglia tra i regimi
  radius?: number; // raggio d'azione in NDC corretto per l'aspect
  fastThreshold?: number; // velocità puntatore (NDC/s) oltre cui scatta il calcio

  // intensità dei tre regimi
  gentleTilt?: number; // (1) inclinazione dolce su hover lento
  kickPos?: number; // (2) spinta di POSIZIONE su swipe veloce
  kickSpin?: number; // (3) spin base su swipe veloce
  edgeSpin?: number; // (3) spin EXTRA su colpo fuori centro (il "360")

  // rientro elastico
  posK?: number; // rigidità molla posizione
  posDamp?: number; // smorzamento posizione
  rotK?: number; // rigidità molla rotazione
  rotDamp?: number; // smorzamento rotazione
}

// Normal map "liquida" procedurale e tileable: un campo di onde sinusoidali
// a bassa frequenza convertito in normali. Sulle facce piatte dei modelli
// incurva i riflessi dell'ambiente creando le venature del cromo liquido
// (una superficie piana a specchio, da sola, rifletterebbe una zona uniforme)
function makeWavyNormalMap(): THREE.CanvasTexture {
  const S = 256;
  const TAU = Math.PI * 2;
  // frequenze intere → la texture è perfettamente ripetibile senza giunture
  const waves = [
    { fx: 1, fy: 2, amp: 1, phase: 0.7 },
    { fx: 2, fy: 1, amp: 0.8, phase: 2.1 },
    { fx: 3, fy: 2, amp: 0.5, phase: 4.4 },
    { fx: 1, fy: 3, amp: 0.6, phase: 1.3 },
    { fx: 2, fy: 3, amp: 0.35, phase: 5.2 },
  ];
  const height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const w of waves) {
        v += w.amp * Math.sin(((w.fx * x + w.fy * y) / S) * TAU + w.phase);
      }
      height[y * S + x] = v;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const slope = 14; // pendenza delle onde: più alto = riflessi più distorti
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dhdx =
        (height[y * S + ((x + 1) % S)] - height[y * S + ((x - 1 + S) % S)]) / 2;
      const dhdy =
        (height[((y + 1) % S) * S + x] - height[((y - 1 + S) % S) * S + x]) / 2;
      const nx = -dhdx * slope;
      const ny = -dhdy * slope;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const i = (y * S + x) * 4;
      img.data[i] = Math.round(nx * inv * 127 + 128);
      img.data[i + 1] = Math.round(ny * inv * 127 + 128);
      img.data[i + 2] = Math.round((1 * inv) * 127 + 128);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.4, 2.4);
  return tex;
}

// Cromo liquido condiviso da tutte le istanze: metallo quasi a specchio con
// clearcoat per l'effetto "bagnato"; i riflessi arrivano dall'<Environment>
const chromeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf6f6f6,
  metalness: 1,
  roughness: 0.05,
  envMapIntensity: 1.8,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
});
if (typeof document !== "undefined") {
  const wavy = makeWavyNormalMap();
  chromeMaterial.normalMap = wavy;
  chromeMaterial.normalScale.set(0.45, 0.45);
  // anche lo strato lucido segue le onde: riflessi coerenti
  chromeMaterial.clearcoatNormalMap = wavy;
  chromeMaterial.clearcoatNormalScale.set(0.45, 0.45);
}

// La normal map richiede le UV: il KX418 non le ha, gliele generiamo con una
// proiezione box (per ogni vertice si usano le due coordinate del piano
// dominante della normale). Le giunture non si notano: la mappa è solo
// una perturbazione morbida
function ensureUVs(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute("uv")) return;
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!pos || !nor) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const scale =
    1 /
    (Math.max(
      bb.max.x - bb.min.x,
      bb.max.y - bb.min.y,
      bb.max.z - bb.min.z,
    ) || 1);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

// Registro di debug (solo dev): magnitudo di offset/spin/tilt per istanza,
// leggibile da console o dai test e2e come window.__kickDebug
const kickDebug: Record<
  string,
  { offset: number; spin: number; tilt: number }
> = {};
let instanceCounter = 0;
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__kickDebug = kickDebug;
}

// limiti anti-instabilità: oltre questi valori la fisica viene troncata,
// così nessuna raffica di impulsi può far "scappare" un modello.
// MAX_OFFSET è il tetto allo spostamento: vola via ma non esce mai dallo
// schermo. MAX_SPIN lascia spazio a un giro completo e mezzo (il "360")
const MAX_OFFSET = 1.6;
const MAX_SPIN = 9.5;
const MAX_VEL_P = 14;
const MAX_VEL_R = 26;
// clamp della velocità del puntatore in unità/SECONDO (indipendente dal
// refresh rate): taglia i salti (alt-tab, ingresso nel viewport)
const MAX_POINTER_SPEED_PER_SEC = 7.2;

export function KickModel({
  url,
  position,
  rotation = [0, 0, 0],
  size = 2.4,
  pointer,
  reduceMotion = false,
  ambient = false,
  radius = 0.55,
  fastThreshold = 0.72, // NDC/s (= 0.012 NDC/frame a 60Hz)
  gentleTilt = 0.5,
  // v3.1: la traslazione era impercettibile (impulso in unità mondo troppo
  // piccolo rispetto ai radianti dello spin) → kickPos molto più alto e
  // molla posizione più morbida: vola fuori e rientra in ~0.6-1s
  kickPos = 30,
  // kickSpin/edgeSpin più alti e molla rotazione più morbida del riferimento
  // v3: coi valori originali un colpo di taglio si fermava a ~90°, così
  // invece un colpo secco sul bordo arriva al giro completo ("360")
  kickSpin = 7,
  edgeSpin = 26,
  posK = 4.2,
  posDamp = 2.4,
  rotK = 3.2,
  rotDamp = 2,
}: KickModelProps) {
  const { scene } = useGLTF(url);

  // Clona (stesso GLB riusabile più volte), croma ogni mesh, poi normalizza:
  // centro del bounding box nell'origine (per far "rotolare" attorno al
  // baricentro) e scala tale che la dimensione massima sia `size`
  const { holder: normalized, sizeFactor } = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        ensureUVs(mesh.geometry);
        mesh.material = chromeMaterial;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const dims = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(dims.x, dims.y, dims.z) || 1;
    const holder = new THREE.Group();
    root.position.sub(center);
    holder.add(root);
    holder.scale.setScalar(size / maxDim);
    // raggio del bounding sphere del modello RENDERIZZATO (già scalato):
    // l'impulso di posizione scala con la taglia, così un colpo sposta
    // "circa mezza lettera" a prescindere da quanto è grande il modello
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const sizeFactor = Math.max(0.4, (sphere.radius * size) / maxDim);
    return { holder, sizeFactor };
  }, [scene, size]);

  const group = useRef<THREE.Group>(null);
  const debugId = useMemo(
    () => `${url.split("/").pop()}#${instanceCounter++}`,
    [url],
  );

  // Stato fisico = offset dal RIPOSO (a riposo tutto è 0 → oggetto fermo).
  // Tutti i vettori sono allocati una volta sola (mai `new` dentro useFrame)
  const offP = useRef(new THREE.Vector3()); // offset posizione
  const velP = useRef(new THREE.Vector3());
  const offR = useRef(new THREE.Vector3()); // spin accumulato
  const velR = useRef(new THREE.Vector3());
  const tilt = useRef(new THREE.Vector2()); // inclinazione dolce (lerp)
  const prevPointer = useRef(new THREE.Vector2());
  const hasPrev = useRef(false);
  const screen = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    // TOUCH: deriva ambientale lenta ATTORNO alla posa di riposo (i modelli
    // "respirano" ma la composizione resta quella tarata); ogni istanza è
    // sfasata dal seed. Il dito resta libero di scrollare: niente fisica
    if (ambient && !reduceMotion) {
      const t = state.clock.elapsedTime;
      const seed = position[0] * 1.7 + position[1] * 0.9;
      g.position.set(
        position[0],
        position[1] + Math.sin(t * 0.5 + seed) * 0.12,
        position[2],
      );
      g.rotation.set(
        rotation[0] + Math.cos(t * 0.25 + seed) * 0.25,
        rotation[1] + Math.sin(t * 0.3 + seed) * 0.4,
        rotation[2] + Math.sin(t * 0.2 + seed) * 0.1,
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

      // centro del modello proiettato in NDC → vettore dal centro al cursore
      screen.current
        .setFromMatrixPosition(g.matrixWorld)
        .project(state.camera);
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
          // sulla taglia del modello (un colpo sposta ~mezza lettera sempre)
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

    // molla POSIZIONE: offP → 0 (sotto-smorzata: rimbalza un po')
    velP.current.addScaledVector(offP.current, -posK * dt);
    velP.current.multiplyScalar(Math.max(0, 1 - posDamp * dt));
    velP.current.clampLength(0, MAX_VEL_P);
    offP.current.addScaledVector(velP.current, dt);
    offP.current.clampLength(0, MAX_OFFSET);

    // molla ROTAZIONE: offR → 0
    velR.current.addScaledVector(offR.current, -rotK * dt);
    velR.current.multiplyScalar(Math.max(0, 1 - rotDamp * dt));
    velR.current.clampLength(0, MAX_VEL_R);
    offR.current.addScaledVector(velR.current, dt);
    offR.current.clampLength(0, MAX_SPIN);

    if (import.meta.env.DEV) {
      kickDebug[debugId] = {
        offset: offP.current.length(),
        spin: offR.current.length(),
        tilt: tilt.current.length(),
      };
    }

    // COMPOSIZIONE finale = RIPOSO FERMO + fisica + inclinazione dolce
    // (nessun idle float: a riposo l'oggetto è immobile come l'originale)
    g.position.set(
      position[0] + offP.current.x,
      position[1] + offP.current.y,
      position[2] + offP.current.z,
    );
    g.rotation.set(
      rotation[0] + offR.current.x + tilt.current.x,
      rotation[1] + offR.current.y + tilt.current.y,
      rotation[2] + offR.current.z,
    );
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      <primitive object={normalized} />
    </group>
  );
}

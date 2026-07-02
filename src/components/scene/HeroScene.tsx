import { Component, Suspense, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { KickModel } from "./KickModel";
import Starfield from "./Starfield";
import { useWindowPointer } from "./useWindowPointer";
import type { PointerState } from "./useWindowPointer";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useIsTouch } from "../../hooks/useIsTouch";
import { setAssetProgress } from "../../lib/assetProgress";

const MODEL_SIGN = `${import.meta.env.BASE_URL}3d/optimized/Japanese_Sign_10.glb`;
const MODEL_KX = `${import.meta.env.BASE_URL}3d/optimized/KX418_003C0_V7.glb`;

// inoltra il progresso reale dei GLB allo store letto dal Loader.
// Registrato PRIMA dei preload (l'onStart sincrono non va perso) e con un
// sync iniziale: da qui in poi il Loader sa che il chunk della scena è vivo
useProgress.subscribe((s) => {
  setAssetProgress({ progress: s.progress, active: s.active });
});
setAssetProgress({
  progress: useProgress.getState().progress,
  active: useProgress.getState().active,
});

useGLTF.preload(MODEL_SIGN);
useGLTF.preload(MODEL_KX);

interface HeroSceneProps {
  reduceMotion?: boolean;
  // false quando l'hero è scrollato fuori vista: il render loop si ferma
  active?: boolean;
}

// Configurazione camera/qualità per fascia di dispositivo. Il desktop usa
// i valori tarati originali; su mobile/tablet la scena viene ri-inquadrata
// e alleggerita (dpr, stelle, risoluzione environment)
interface ViewConfig {
  fov: number;
  camZ: number;
  dpr: [number, number];
  starFactor: number;
  envRes: number;
  // true: i modelli vengono scalati per stare nella larghezza visibile
  fitToView: boolean;
}

const DESKTOP_VIEW: ViewConfig = {
  fov: 40,
  camZ: 9.5,
  dpr: [1, 2],
  starFactor: 1,
  envRes: 256,
  fitToView: false, // desktop: composizione originale, nessun riadattamento
};

interface ModelSpec {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: number;
}

interface SceneLayout {
  models: ModelSpec[];
  // ingombro complessivo in unità mondo (modelli inclusi i bordi):
  // usato per calcolare il fattore di fit rispetto alla viewport reale
  width: number;
  height: number;
  yOffset: number; // trasla il gruppo (portrait: su, via dal titolo in basso)
}

// fila orizzontale: la composizione desktop originale — valori tarati,
// riusata anche su tablet/landscape (con fit-scale se serve)
const ROW_LAYOUT: SceneLayout = {
  models: [
    {
      url: MODEL_KX,
      position: [-4.1, 0.15, 0],
      rotation: [0.95, 0.5, -1.02],
      size: 2.5,
    },
    {
      url: MODEL_SIGN,
      position: [-1.4, -0.1, 0],
      rotation: [1.12, -0.35, 0.15],
      size: 2.6,
    },
    {
      url: MODEL_KX,
      position: [1.3, 0.1, 0],
      rotation: [-0.3, -0.45, 1.2],
      size: 2.3,
    },
    {
      url: MODEL_SIGN,
      position: [3.9, -0.05, 0],
      rotation: [-1.0, 0.4, -0.3],
      size: 2.2,
    },
  ],
  width: 10.8,
  height: 4.4,
  yOffset: 0,
};

// portrait stretto: la fila non ci sta MAI in larghezza → colonna a zigzag
// (lo spazio è verticale); stesse rotazioni di riposo della fila
const COLUMN_LAYOUT: SceneLayout = {
  models: [
    {
      url: MODEL_KX,
      position: [-1.15, 3.0, 0],
      rotation: [0.95, 0.5, -1.02],
      size: 2.5,
    },
    {
      url: MODEL_SIGN,
      position: [1.0, 1.1, 0],
      rotation: [1.12, -0.35, 0.15],
      size: 2.6,
    },
    {
      url: MODEL_KX,
      position: [-1.0, -0.9, 0],
      rotation: [-0.3, -0.45, 1.2],
      size: 2.3,
    },
    {
      url: MODEL_SIGN,
      position: [1.1, -2.9, 0],
      rotation: [-1.0, 0.4, -0.3],
      size: 2.2,
    },
  ],
  width: 4.9,
  height: 8.4,
  yOffset: 0.55,
};

// Applica fov/z al volo (breakpoint o rotazione device): il prop camera del
// Canvas vale solo al mount. Nel useFrame (come CameraRig): il cambio di
// breakpoint arriva sempre con un resize, che fa girare un frame anche in
// frameloop="demand"
function CameraConfig({ fov, camZ }: { fov: number; camZ: number }) {
  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    if (cam.fov !== fov || cam.position.z !== camZ) {
      cam.fov = fov;
      cam.position.z = camZ;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

// Leggera parallasse: la camera segue il puntatore con un lerp morbido e
// resta puntata sul centro — dà profondità a stelle e modelli senza
// muovere nient'altro
function CameraRig({
  pointer,
  reduceMotion,
}: {
  pointer: RefObject<PointerState>;
  reduceMotion: boolean;
}) {
  const target = useRef(new THREE.Vector3(0, 0, 0));
  useFrame((state, delta) => {
    if (reduceMotion) return;
    const p = pointer.current;
    const k = 1 - Math.exp(-2.5 * Math.min(delta, 0.05)); // lerp frame-rate independent
    state.camera.position.x += (p.x * 0.45 - state.camera.position.x) * k;
    state.camera.position.y += (p.y * 0.3 - state.camera.position.y) * k;
    state.camera.lookAt(target.current);
  });
  return null;
}

// Texture "cielo/terra" per il cromo classico da paraurti: metà alta chiara
// con gradiente, orizzonte netto, metà bassa scura. Le superfici che tagliano
// l'orizzonte mostrano la venatura ad alto contrasto tipica del metallo lucido
function makeHorizonTexture(): THREE.CanvasTexture {
  const w = 16;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // cielo: bianco pieno in alto → argento verso l'orizzonte (orizzonte
  // basso: le facce rivolte alla camera riflettono soprattutto cielo).
  // Contrasto spinto: è quello che fa "bruciare" le creste a bianco e
  // annerire i fianchi, come nel riferimento
  const HORIZON = 0.62;
  const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
  sky.addColorStop(0, "#ffffff");
  sky.addColorStop(0.65, "#b3b6c2");
  sky.addColorStop(1, "#ffffff"); // banda brillante appena sopra l'orizzonte
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * HORIZON);

  // terra: stacco netto, poi quasi nero
  const ground = ctx.createLinearGradient(0, h * HORIZON, 0, h);
  ground.addColorStop(0, "#1c1c22");
  ground.addColorStop(0.4, "#0a0a0e");
  ground.addColorStop(1, "#020203");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * HORIZON, w, h * (1 - HORIZON));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Ambiente procedurale (niente HDR da rete: funziona offline e non pesa sul
// caricamento): sfera cielo/terra + qualche striscia luminosa per i riflessi
function ChromeEnvironment({ resolution = 256 }: { resolution?: number }) {
  const horizon = useMemo(() => makeHorizonTexture(), []);
  return (
    <Environment resolution={resolution} frames={1}>
      <mesh scale={50}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial map={horizon} side={THREE.BackSide} />
      </mesh>
      {/* key light dall'alto: la striscia di riflesso bianco sulle creste */}
      <Lightformer
        intensity={6.5}
        position={[0, 6, 2]}
        rotation-x={Math.PI / 2}
        scale={[10, 5, 1]}
      />
      {/* striscia diagonale dietro la camera: venatura sulle facce frontali */}
      <Lightformer
        intensity={3}
        position={[2, 1, 8]}
        rotation-z={-0.35}
        scale={[14, 0.8, 1]}
      />
      {/* controluce laterale tenue */}
      <Lightformer
        intensity={1.8}
        position={[-6, -0.5, 3]}
        rotation-y={Math.PI / 2.6}
        scale={[6, 2.5, 1]}
      />
    </Environment>
  );
}

function SceneContents({
  reduceMotion,
  ambient,
  portrait,
  view,
}: {
  reduceMotion: boolean;
  ambient: boolean;
  portrait: boolean;
  view: ViewConfig;
}) {
  const pointer = useWindowPointer();
  const size = useThree((s) => s.size);

  // larghezza/altezza VISIBILI a z=0 calcolate da fov/z configurati (non da
  // state.viewport, che non si aggiorna quando CameraConfig cambia la camera)
  const column = view.fitToView && portrait;
  const layout = column ? COLUMN_LAYOUT : ROW_LAYOUT;
  const worldH = 2 * view.camZ * Math.tan((view.fov * Math.PI) / 360);
  const worldW = worldH * (size.width / size.height);
  // margine del 6% ai lati / 8% sopra-sotto; su desktop resta 1 (originale)
  const fit = view.fitToView
    ? Math.min(
        1,
        (worldW * 0.94) / layout.width,
        (worldH * 0.92) / layout.height,
      )
    : 1;

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.15} />
      <Starfield reduceMotion={reduceMotion} factor={view.starFactor} />
      <CameraRig pointer={pointer} reduceMotion={reduceMotion} />
      <Suspense fallback={null}>
        <ChromeEnvironment resolution={view.envRes} />
        {/* composizione come l'originale: oggetti FERMI, allineati in fila
            orizzontale come lettere, stessa quota, spaziatura coerente.
            Il cartello è un pannello (faccia larga con normale Y): X ~ ±1.1
            la inclina verso la camera. Il KX418 è una trave lunga in Y:
            Z ~ ±1 la mette in diagonale. Su portrait la fila diventa una
            colonna a zigzag e il gruppo viene scalato per stare in vista */}
        <group scale={fit} position={[0, layout.yOffset, 0]}>
          {/* key sul layout EFFETTIVO (non su portrait): su desktop non
              rimonta mai, la fisica del calcio sopravvive ai resize */}
          {layout.models.map((m, i) => (
            <KickModel
              key={`${column}-${i}`}
              url={m.url}
              position={m.position}
              rotation={m.rotation}
              size={m.size}
              pointer={pointer}
              reduceMotion={reduceMotion}
              ambient={ambient}
            />
          ))}
        </group>
      </Suspense>
    </>
  );
}

interface BoundaryState {
  failed: boolean;
}

// Se WebGL non è disponibile la scena sparisce senza far crollare la pagina:
// restano sfondo nero, titolo e UI
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroScene({
  reduceMotion = false,
  active = true,
}: HeroSceneProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const portrait = useMediaQuery("(orientation: portrait)");
  // su touch niente calcio (il dito serve a scrollare): deriva ambientale
  const isTouch = useIsTouch();

  const view: ViewConfig = isMobile
    ? {
        fov: portrait ? 55 : 45,
        camZ: portrait ? 8.5 : 8,
        dpr: [1, 1.5],
        starFactor: 0.55,
        envRes: 128,
        fitToView: true,
      }
    : isTablet || (isTouch && portrait)
      ? {
          // isTouch && portrait copre i tablet larghi ≥1024px (iPad Pro
          // 12.9"/13" in portrait) che sfuggirebbero al max-width: 1023;
          // su desktop col mouse isTouch è false → DESKTOP_VIEW intatto
          fov: portrait ? 52 : 45,
          camZ: portrait ? 8 : 7.5,
          dpr: [1, 2],
          starFactor: 0.8,
          envRes: 256,
          fitToView: true,
        }
      : DESKTOP_VIEW;

  return (
    <SceneErrorBoundary>
      <Canvas
        dpr={view.dpr}
        camera={{
          fov: view.fov,
          position: [0, 0, view.camZ],
          near: 0.1,
          far: 90,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          // ACES (default R3F) + esposizione alta: i riflessi più forti
          // "bruciano" a bianco come nell'originale
          gl.toneMappingExposure = 1.15;
        }}
        frameloop={reduceMotion ? "demand" : active ? "always" : "never"}
        // il touch verticale sul canvas deve scrollare la pagina
        style={{ touchAction: "pan-y" }}
      >
        <CameraConfig fov={view.fov} camZ={view.camZ} />
        <SceneContents
          reduceMotion={reduceMotion}
          ambient={isTouch}
          portrait={portrait}
          view={view}
        />
      </Canvas>
    </SceneErrorBoundary>
  );
}

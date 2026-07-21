import { Component, Suspense, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import UranioLogo, { URANIO_URL } from "./UranioLogo";
import Starfield from "./Starfield";
import { useWindowPointer } from "./useWindowPointer";
import type { PointerState } from "./useWindowPointer";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useIsTouch } from "../../hooks/useIsTouch";
import { setAssetProgress } from "../../lib/assetProgress";

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

// il logo Uranio (lettere + emblema) è l'unico modello dell'hero: preload DOPO
// la subscription qui sopra, così l'onStart sincrono non va perso
useGLTF.preload(URANIO_URL);

interface HeroSceneProps {
  reduceMotion?: boolean;
  // false quando l'hero è scrollato fuori vista: il render loop si ferma
  active?: boolean;
}

// Configurazione camera/qualità per fascia di dispositivo. Il logo è ~quadrato
// e viene sempre adattato alla viewport da UranioLogo (fit-to-view interno),
// quindi qui bastano fov/distanza camera + parametri di qualità
interface ViewConfig {
  fov: number;
  camZ: number;
  dpr: [number, number];
  starFactor: number;
  envRes: number;
}

const DESKTOP_VIEW: ViewConfig = {
  fov: 40,
  camZ: 9.5,
  dpr: [1, 2],
  starFactor: 1,
  envRes: 256,
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
  // orizzonte un po' sopra la metà. Le facce FRONTALI (piatte) delle lettere
  // riflettono la fascia d'orizzonte: la teniamo argento MEDIO (non bianca),
  // altrimenti le lettere piatte diventano bianche uniformi. Il bianco arriva
  // dagli highlight nitidi delle key light, non dal fondo dell'ambiente
  const HORIZON = 0.55;
  const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
  sky.addColorStop(0, "#b8bbc5"); // cielo: argento, per le creste rivolte in su
  sky.addColorStop(0.7, "#cccfd8");
  sky.addColorStop(1, "#dde0e8"); // orizzonte: argento chiaro, NON bianco
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * HORIZON);

  // TERRA: grigio MEDIO, non scuro. Le lettere stanno in basso e riflettono
  // verso il suolo: con un suolo scuro le facce inferiori facevano "ombra".
  // Un grigio medio-chiaro le tiene argento, con solo un lieve gradiente verso
  // il basso — ancora cromo, ma senza zone in ombra
  const ground = ctx.createLinearGradient(0, h * HORIZON, 0, h);
  ground.addColorStop(0, "#9a9aa2"); // subito sotto l'orizzonte: argento medio
  ground.addColorStop(0.45, "#75757d");
  ground.addColorStop(1, "#5c5c64"); // fondo: grigio medio, non scuro
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
      {/* KEY LIGHT: fascia luminosa larga in alto → l'highlight bianco netto
          sulle creste (UNA banda pulita, non le righe della vecchia normal
          map). È questo riflesso brillante su corpo argento a dare il cromo */}
      <Lightformer
        intensity={7}
        position={[0, 5.5, 3]}
        rotation-x={Math.PI / 2}
        scale={[11, 2.6, 1]}
      />
      {/* accento diagonale morbido: un secondo highlight sulle facce frontali,
          ampio così resta un bagliore pulito e non una riga sottile */}
      <Lightformer
        intensity={2.2}
        position={[-3, 1.5, 6]}
        rotation-z={0.5}
        scale={[7, 1.8, 1]}
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

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.15} />
      <Starfield reduceMotion={reduceMotion} factor={view.starFactor} />
      <CameraRig pointer={pointer} reduceMotion={reduceMotion} />
      <Suspense fallback={null}>
        <ChromeEnvironment resolution={view.envRes} />
        {/* il logo Uranio: emblema + 6 lettere, ciascuno calciabile per conto
            suo. Il fit alla viewport è calcolato dentro UranioLogo (il logo è
            ~quadrato: entra bene sia in landscape che in portrait). Nessun
            remount sui resize → la fisica del calcio sopravvive */}
        <UranioLogo
          pointer={pointer}
          reduceMotion={reduceMotion}
          ambient={ambient}
          fov={view.fov}
          camZ={view.camZ}
          portrait={portrait}
        />
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
          // ACES (default R3F): roll-off morbido delle alte luci → gli
          // highlight delle key light restano bianchi brillanti senza clippare
          // a bianco piatto, il corpo resta argento. Leggermente sopra 1: le
          // lettere in basso restano luminose, senza ombre
          gl.toneMappingExposure = 1.08;
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

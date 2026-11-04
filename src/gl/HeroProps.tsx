import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PROPS } from "../config/props.ts";
import { COLORS } from "../config/theme.ts";
import { bottleRise, sharedIntro } from "../core/Intro.ts";
import { sharedMapper, type SceneState } from "../core/StateMapper.ts";
import { sharedViewport } from "../hooks/useViewport";
import { makeGlowTexture } from "./glowTexture.ts";

/** il colore pieno del disco: l'ingresso lo scala */
const DISCO = new THREE.Color(PROPS.faro.discColor);

function posiziona(
  faro: THREE.Group | null,
  base: THREE.Group | null,
  disco: THREE.MeshBasicMaterial | null,
  s: SceneState,
  sale: number,
) {
  // `props` va da 0 (in scena) a 1 (usciti dal frame) con le laterali: il
  // faro esce in alto, il piedistallo in basso
  const fuori = s.props;
  // l'ingresso: il faro scende e si accende, il piedistallo sale insieme
  // alla protagonista, così lei ci resta sopra
  disco?.color.copy(DISCO).multiplyScalar(sale);
  if (faro) {
    faro.visible = fuori < 1;
    faro.position.set(
      s.pivot.x,
      s.pivot.y + PROPS.faro.y + PROPS.exitUp * fuori + (1 - sale) * PROPS.exitUp,
      s.pivot.z + PROPS.faro.z,
    );
  }
  if (base) {
    base.visible = fuori < 1;
    base.position.set(
      s.pivot.x,
      s.pivot.y + PROPS.base.y - PROPS.exitDown * fuori - (1 - sale) * PROPS.exitDown,
      s.pivot.z,
    );
  }
}

/** metallo cromato: è l'ambiente riflesso a disegnarlo, non le luci */
function Cromo() {
  return <meshStandardMaterial color="#D9D9D9" metalness={1} roughness={0.14} />;
}

/**
 * Faro e piedistallo dell'anello (spec 6.7), allo step 0.
 *
 * Il faro sta sopra la bottiglia e **tagliato dal bordo alto**: nel
 * riferimento si vede solo la metà bassa del disco, ed è quel taglio a far
 * sembrare la scena più grande del frame. Sotto ha un cono di luce appena
 * accennato. Il piedistallo è un cilindro scuro con i bordi cromati, un filo
 * rosso emissivo e un bagliore additivo sotto; sopra ci si appoggia il
 * logotipo "CRISI ECONOMICA" in HTML (`ui/HeroUi.tsx`).
 */
export function HeroProps() {
  const faro = useRef<THREE.Group>(null);
  const base = useRef<THREE.Group>(null);
  const disco = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useMemo(
    () =>
      makeGlowTexture([
        [0, COLORS.red],
        [0.45, COLORS.amber],
        [1, "rgba(0,0,0,0)"],
      ]),
    [],
  );
  // il cono: dal bianco in alto al niente in basso, lungo la v della geometria
  const fascio = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(255,244,232,1)");
    g.addColorStop(1, "rgba(255,244,232,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(
    () => () => {
      glow.dispose();
      fascio.dispose();
    },
    [glow, fascio],
  );

  const mapper = sharedMapper(sharedViewport().state);
  const intro = sharedIntro();
  useFrame(() =>
    posiziona(
      faro.current,
      base.current,
      disco.current,
      mapper.state,
      bottleRise(intro.value),
    ),
  );

  const { faro: f, base: b } = PROPS;
  const fondo = -f.shellHeight / 2;
  return (
    <>
      <group ref={faro}>
        {/* la scocca: metallo scuro, vista da sotto */}
        <mesh>
          <cylinderGeometry args={[f.shellRadius, f.shellRadius * 0.92, f.shellHeight, 64]} />
          <meshStandardMaterial color={f.shellColor} metalness={0.9} roughness={0.4} />
        </mesh>
        {/* gli anelli cromati sul fondo: i pezzi che prendono i riflessi */}
        {f.rings.map((r) => (
          <mesh key={r.radius} rotation-x={Math.PI / 2} position-y={fondo}>
            <torusGeometry args={[r.radius, r.tube, 16, 96]} />
            <Cromo />
          </mesh>
        ))}
        {/* il disco che fa luce. Lo spot che illumina davvero la bottiglia è
            in `Lights.tsx`: qui c'è la sorgente da guardare */}
        <mesh rotation-x={Math.PI / 2} position-y={fondo - 0.01}>
          <circleGeometry args={[f.discRadius, 64]} />
          <meshBasicMaterial
            ref={disco}
            color={f.discColor}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* il cono di luce, aperto sotto e senza profondità: non taglia niente */}
        <mesh position-y={fondo - f.beam.length / 2}>
          <cylinderGeometry
            args={[f.beam.radiusTop, f.beam.radiusBottom, f.beam.length, 48, 1, true]}
          />
          <meshBasicMaterial
            map={fascio}
            transparent
            opacity={f.beam.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>

      <group ref={base}>
        <mesh>
          <cylinderGeometry args={[b.radius, b.radius * 1.04, b.height, 64]} />
          <meshStandardMaterial color={b.color} metalness={0.6} roughness={0.5} />
        </mesh>
        {/* i bordi cromati, sopra e sotto */}
        <mesh rotation-x={Math.PI / 2} position-y={b.height / 2}>
          <torusGeometry args={[b.radius, b.chromeTube, 12, 128]} />
          <Cromo />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-y={-b.height / 2}>
          <torusGeometry args={[b.radius * 1.04, b.chromeTube, 12, 128]} />
          <Cromo />
        </mesh>
        {/* il filo rosso appena dentro il bordo alto */}
        <mesh rotation-x={Math.PI / 2} position-y={b.height / 2 + 0.003}>
          <torusGeometry args={[b.rimRadius, b.rimTube, 8, 128]} />
          <meshBasicMaterial color={b.rimColor} toneMapped={false} />
        </mesh>
        {/* il bagliore: un piano orizzontale appena sopra il piedistallo, la
            luce del faro che ci cade sopra. Additivo e senza profondità */}
        <mesh rotation-x={-Math.PI / 2} position-y={b.height / 2 + 0.002}>
          <planeGeometry args={[b.glowScale, b.glowScale]} />
          <meshBasicMaterial
            map={glow}
            transparent
            opacity={b.glowOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}

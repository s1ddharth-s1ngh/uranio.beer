import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PROPS } from "../config/props.ts";
import { COLORS } from "../config/theme.ts";
import { sharedMapper, type SceneState } from "../core/StateMapper.ts";
import { sharedViewport } from "../hooks/useViewport";

/**
 * Il bagliore sotto il piedistallo: una texture generata a runtime, non un
 * file.
 *
 * È un gradiente radiale rosso→ambra→trasparente; disegnarlo su una canvas
 * 2D costa una volta sola e risparmia una richiesta di rete e un asset da
 * tenere allineato alla palette. Additivo, così si somma al pavimento dello
 * sfondo invece di coprirlo.
 */
function makeGlowTexture(): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, COLORS.red);
  g.addColorStop(0.45, COLORS.amber);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function posiziona(
  faro: THREE.Group | null,
  base: THREE.Group | null,
  s: SceneState,
) {
  // `props` va da 0 (in scena) a 1 (usciti dal frame) nella finestra [0; 0,5]
  // del primo segmento: il faro esce in alto, il piedistallo in basso
  const fuori = s.props;
  if (faro) {
    faro.visible = fuori < 1;
    faro.position.set(
      s.pivot.x,
      s.pivot.y + PROPS.faro.y + PROPS.exitUp * fuori,
      s.pivot.z + PROPS.faro.z,
    );
  }
  if (base) {
    base.visible = fuori < 1;
    base.position.set(
      s.pivot.x,
      s.pivot.y + PROPS.base.y - PROPS.exitDown * fuori,
      s.pivot.z,
    );
  }
}

/**
 * Faro e piedistallo dell'hero (spec 6.7).
 *
 * Il faro sta sopra la bottiglia e **tagliato dal bordo alto**: nel
 * riferimento si vede solo la metà bassa dell'anello, ed è quel taglio a far
 * sembrare la scena più grande del frame. Il piedistallo è un cilindro basso
 * con un filo rosso emissivo sul bordo e un bagliore additivo sotto; sopra ci
 * si appoggia il logotipo "CRISI ECONOMICA" in HTML (task 8.19).
 */
export function HeroProps() {
  const faro = useRef<THREE.Group>(null);
  const base = useRef<THREE.Group>(null);
  const glow = useMemo(() => makeGlowTexture(), []);

  useEffect(() => () => glow.dispose(), [glow]);

  const mapper = sharedMapper(sharedViewport().state);
  useFrame(() => posiziona(faro.current, base.current, mapper.state));

  const { faro: f, base: b } = PROPS;
  return (
    <>
      <group ref={faro}>
        {/* la scocca: metallo scuro, vista da sotto */}
        <mesh>
          <cylinderGeometry args={[f.shellRadius, f.shellRadius, f.shellHeight, 64]} />
          <meshStandardMaterial
            color={f.shellColor}
            metalness={0.9}
            roughness={0.45}
          />
        </mesh>
        {/* l'anello lucido: è il pezzo che prende i riflessi dell'ambiente */}
        <mesh rotation-x={Math.PI / 2} position-y={-f.shellHeight / 2}>
          <torusGeometry args={[f.ringRadius, f.ringTube, 16, 96]} />
          <meshStandardMaterial color="#D8D8D8" metalness={1} roughness={0.12} />
        </mesh>
        {/* il disco emissivo: la luce che si vede dentro il faro. Lo spot che
            illumina davvero la bottiglia è in `Lights.tsx` — qui c'è la
            sorgente da guardare, là quella che conta per l'illuminazione */}
        <mesh rotation-x={Math.PI / 2} position-y={-f.shellHeight / 2 - 0.01}>
          <circleGeometry args={[f.discRadius, 64]} />
          <meshBasicMaterial
            color={f.discColor}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <group ref={base}>
        <mesh>
          <cylinderGeometry args={[b.radius, b.radius * 1.04, b.height, 64]} />
          <meshStandardMaterial color={b.color} metalness={0.4} roughness={0.6} />
        </mesh>
        {/* il filo rosso sul bordo alto */}
        <mesh rotation-x={Math.PI / 2} position-y={b.height / 2}>
          <torusGeometry args={[b.radius, b.rimTube, 8, 128]} />
          <meshBasicMaterial color={b.rimColor} toneMapped={false} />
        </mesh>
        {/* il bagliore: un piano orizzontale appena sopra il piedistallo,
            additivo e senza profondità, così non taglia niente */}
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

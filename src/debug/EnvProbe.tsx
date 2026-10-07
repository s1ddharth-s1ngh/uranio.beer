import { BOTTLE } from "../config/bottle.ts";

/**
 * `?debug=env`: due sfere di prova al posto della bottiglia, una metallica e
 * una lucida scura, per guardare cosa riflette l'ambiente (task 8.8). È il
 * modo più diretto di capire se le strisce verticali ci sono e dove cadono —
 * su una sfera si vedono per quello che sono, su un vetro scuro no.
 */
export default function EnvProbe() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[-1.2, 0, 0]}>
        <sphereGeometry args={[BOTTLE.bodyRadius, 64, 64]} />
        <meshPhysicalMaterial metalness={1} roughness={0.08} color="#ffffff" />
      </mesh>
      <mesh position={[1.2, 0, 0]}>
        <sphereGeometry args={[BOTTLE.bodyRadius, 64, 64]} />
        <meshPhysicalMaterial
          metalness={0}
          roughness={0.06}
          clearcoat={1}
          color="#15110d"
        />
      </mesh>
    </group>
  );
}

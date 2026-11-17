import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import FallingStars from "../components/scene/FallingStars";
import Starfield from "../components/scene/Starfield";
import { CAMERA } from "../config/solvePivot.ts";
import { useViewport } from "../hooks/useViewport";

/** la camera del hero sta ferma a questa distanza dal centro del suo cielo (`HeroScene`) */
const HERO_CAM_Z = 9.5;
const HERO_FOV = 40;

/**
 * La camera della scena è un tele: inquadra meno della metà del cielo del
 * hero, e con le stesse stelle ne mostrerebbe la metà. Le stelle sono punti
 * da pochi pixel e costano niente: se ne mettono di più per avere la stessa
 * densità a schermo.
 */
const tanMezzo = (fov: number) => Math.tan((fov * Math.PI) / 360);
const DENSITA = (tanMezzo(HERO_FOV) / tanMezzo(CAMERA.fov)) ** 2;

/**
 * Lo sfondo della sezione 1, anche qui (richiesta del 2026-11-17: "vorrei lo
 * stesso background che c'è nella prima sezione"): il nero della pagina, che
 * si vede attraverso il canvas trasparente, lo stesso campo di stelle del
 * hero e le stesse stelle cadenti — gli stessi componenti, non copie.
 *
 * Il cielo segue la camera. Nel hero la camera sta ferma; qui va da 11 a 14,5
 * dal pivot da uno step all'altro, e le stelle vicine (raggio 9–17) le
 * passerebbero accanto come fiocchi. Spostato con lei, resta all'infinito.
 *
 * Al posto dello shader di prima (studio, alone rosso, nebbia a fbm su un
 * secondo canvas WebGL): un contesto in meno, e un fragment shader a schermo
 * intero in meno.
 */
export function Stars({ reduced }: { reduced: boolean }) {
  const cielo = useRef<THREE.Group>(null);
  const vp = useViewport();
  useFrame(({ camera }) => {
    cielo.current?.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z - HERO_CAM_Z,
    );
  });
  return (
    <>
      <group ref={cielo}>
        <Starfield reduceMotion={reduced} factor={DENSITA} />
      </group>
      {/* le stelle cadenti sono in spazio schermo: la camera non le tocca.
          Con la stessa densità del hero per formato, e come lì niente col
          moto ridotto: una meteora ferma a metà corsa sembrerebbe un graffio */}
      {!reduced && <FallingStars factor={vp.mobile ? 0.55 : vp.portrait ? 0.8 : 1} />}
    </>
  );
}

import { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  BAND_ORDER,
  BANDS,
  LABEL,
  LABEL_U_TO_DEG,
  MODEL_URL,
  vFromY,
} from "../config/bottle.ts";
import { COLORS } from "../config/theme.ts";
import styles from "./BandsProbe.module.css";

/**
 * `?debug=bands` (task 8.10): la texture dell'etichetta in un angolo, con
 * sopra disegnate le quattro fasce.
 *
 * Serve a rispondere a una domanda sola: **la fascia che si accende in 3D è
 * davvero quel blocco di testo?** I numeri delle fasce vengono dai pixel della
 * texture (`config/bottle.ts`), e l'unico modo di controllarli è vederli
 * disegnati sopra la texture vera. In 3D, in parallelo, `Bottle.tsx` fa
 * ciclare la fascia accesa sulle quattro.
 */
export default function BandsProbe() {
  const { scene } = useGLTF(MODEL_URL, false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const mesh = scene.getObjectByName("etichetta") as THREE.Mesh | undefined;
    const mappa = (mesh?.material as THREE.MeshStandardMaterial | undefined)?.map;
    const img = mappa?.image as CanvasImageSource | undefined;
    const ctx = c.getContext("2d");
    if (!img || !ctx) return;

    const { width: w, height: h } = LABEL.texture;
    c.width = w;
    c.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    // la striscia del retro: è lì che stanno le quattro fasce (u 0,55 → 1)
    const xRetro = LABEL_U_TO_DEG.back.uMin * w;
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xRetro, 0);
    ctx.lineTo(xRetro, h);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.font = "600 30px monospace";
    ctx.textBaseline = "top";
    for (const nome of BAND_ORDER) {
      const { px } = BANDS[nome];
      ctx.strokeStyle = COLORS.red;
      ctx.strokeRect(xRetro, px[0], w - xRetro, px[1] - px[0]);
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(xRetro, px[0], 86, 38);
      ctx.fillStyle = COLORS.white;
      ctx.fillText(nome.toUpperCase(), xRetro + 10, px[0] + 5);
    }
  }, [scene]);

  return (
    <div className={styles.host}>
      <canvas ref={canvas} className={styles.canvas} />
      <ul className={styles.legenda}>
        {BAND_ORDER.map((nome) => {
          const b = BANDS[nome];
          return (
            <li key={nome}>
              {nome}: px {b.px[0]}–{b.px[1]} · y {b.y.toFixed(3)} ±{" "}
              {b.half.toFixed(3)} · v {vFromY(b.y).toFixed(3)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

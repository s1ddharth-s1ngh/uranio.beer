// Lo sfondo dell'esperienza (spec 6.8 e appendice 10.4): un quad a tutto
// schermo con tre atmosfere in un solo shader — lo studio dell'hero, l'alone
// rosso cupo degli step, la nebbia viva del finale — e tre pesi che `p`
// incrocia durante le transizioni.
//
// Non è un Canvas R3F. Qui dentro non c'è una scena: c'è un rettangolo e un
// fragment shader. Un secondo root R3F porterebbe un secondo grafo, un secondo
// sistema di eventi e un secondo osservatore di resize per disegnare due
// triangoli, e andrebbe comunque avanzato a mano dal nostro ticker.

import * as THREE from "three";
import { BG, BG_COLORS } from "../config/background.ts";
import type { ViewportState } from "../core/Viewport.ts";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uTime, uSeed, uHero, uStep, uFinale, uGrain;
uniform vec3 cBlack, cFloor, cRed, cAmber, cOx, cNight, cFog1, cFog2, cFog3, cDeep;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 q = vec2((vUv.x - 0.5) * asp, vUv.y);

  // hero: fondo nero in alto, pavimento chiaro in basso, due macchie
  // colorate sotto il piedistallo
  float fl = smoothstep(0.9, 0.0, length(vec2(q.x * 0.55, (vUv.y - 0.12) * 1.6)));
  vec3 hero = mix(cBlack, cFloor, fl * 0.9)
            + cRed   * 0.25 * smoothstep(0.35, 0.0, length(q - vec2(-0.30, 0.05)))
            + cAmber * 0.20 * smoothstep(0.35, 0.0, length(q - vec2( 0.30, 0.05)));

  // step: alone rosso cupo centrato in alto, il resto quasi nero
  vec3 stp = mix(cNight, cOx, smoothstep(1.1, 0.0, length(vec2(q.x * 0.8, (vUv.y - 0.25) * 1.2))));

  // finale: nebbia a fbm, animata lenta
  vec2 fp = q * 1.6 + vec2(uTime, -uTime * 0.5);
  float n = fbm(fp + fbm(fp * 0.8 + uTime * 0.66));
  vec3 fog = mix(cDeep, cFog1, smoothstep(0.0, 0.9, vUv.y * 0.6 + n * 0.7));
  fog = mix(fog, cFog2, smoothstep(0.55, 0.85, n));
  fog = mix(fog, cFog3, smoothstep(0.75, 0.95, n) * 0.6);

  vec3 col = hero * uHero + stp * uStep + fog * uFinale;
  col *= mix(0.55, 1.0, smoothstep(1.2, 0.35, length((vUv - 0.5) * vec2(asp * 0.9, 1.0))));
  // la grana è l'unica cosa che tiene lontane le bande su un gradiente così
  // ampio: senza, un fondo quasi nero a 8 bit si vede a scalini
  // uSeed e' il tempo in secondi non riscalato: la nebbia respira piano
  // (uTime e' gia' moltiplicato per 0,03) ma la grana deve cambiare a ogni
  // frame, o diventa una trama fissa stampata sopra l'immagine.
  // NB: in questo blocco GLSL non si possono usare gli apici inversi, che
  // chiuderebbero il template literal che lo contiene.
  col += (hash(vUv * uRes + fract(uSeed) * 100.0) - 0.5) * uGrain;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface BackgroundWeights {
  hero: number;
  step: number;
  finale: number;
}

export class Background {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const uniforms: Record<string, { value: unknown }> = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSeed: { value: 0 },
      uHero: { value: 1 },
      uStep: { value: 0 },
      uFinale: { value: 0 },
      uGrain: { value: BG.grain },
    };
    for (const [nome, hex] of Object.entries(BG_COLORS)) {
      uniforms[nome] = { value: new THREE.Color(hex) };
    }
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    // Il quad copre lo schermo in clip space, quindi niente camera da
    // impostare e niente matrici da aggiornare: il vertex shader scrive
    // `gl_Position` dalle coordinate del piano così come sono.
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  resize(vp: ViewportState) {
    this.renderer.setPixelRatio(vp.dpr * BG.dpr);
    this.renderer.setSize(vp.width, vp.height, false);
    (this.material.uniforms.uRes.value as THREE.Vector2).set(
      vp.width,
      vp.height,
    );
  }

  render(time: number, w: BackgroundWeights) {
    const u = this.material.uniforms;
    u.uTime.value = time * BG.timeScale;
    u.uSeed.value = time;
    u.uHero.value = w.hero;
    u.uStep.value = w.step;
    u.uFinale.value = w.finale;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

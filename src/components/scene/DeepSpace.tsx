import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Lo spazio profondo: il soggetto al centro pesa così tanto da piegare la
// luce (lente gravitazionale). Il nucleo di una galassia lontana, quasi
// esattamente dietro, si apre in un anello sottile attorno al soggetto, con
// un lato più acceso che gira piano. Le stelle derivano piano e, passandogli
// vicino, gli scivolano attorno, si sdoppiano e si stirano ad arco. Ogni
// tanto una cometa passa proprio dietro: la lente la apre in due archi che
// corrono lungo l'anello.
// La lente è calcolata per pixel e all'indietro (dal punto dello schermo a
// dove starebbe la luce senza la massa), così archi e anello vengono curvi da
// soli. In spazio schermo come FallingStars: niente camera, tempo dai delta
// di useFrame. Piano e scelte: docs/STELLE_CADENTI.md

interface DeepSpaceProps {
  // densità delle stelle: 1 = desktop. HeroScene passa lo starFactor
  factor?: number;
  // centro della lente sopra il centro del canvas, in frazioni dell'altezza:
  // nel hero è il centro del logo, che UranioLogo alza un poco
  lift?: number;
  // raggio di Einstein delle stelle in frazioni del lato corto del canvas;
  // 0 = niente lente
  lens?: number;
  // fermo: niente deriva, niente comete, l'anello non gira
  reduceMotion?: boolean;
}

const SKY = {
  // stelle per megapixel CSS del quadrato in cui derivano (che copre lo
  // schermo dal centro della lente fino all'angolo più lontano): la densità
  // è la stessa su ogni schermo, il telefono non diventa una nevicata
  density: 260,
  maxStars: 2600,
  // deriva verso il basso a sinistra, come le stelle cadenti (px CSS al
  // secondo per lo strato più lontano; il più vicino va tre volte più veloce)
  drift: 3,
  driftDir: [-0.8, -0.6],
  // le comete che passano dietro al soggetto: periodo di ogni slot (s) e
  // quota di giri in cui passa davvero
  comets: [
    { period: 16, on: 0.8 },
    { period: 27, on: 0.6 },
  ],
  // il nucleo della galassia dietro al soggetto: la sua luce (lineare: dopo
  // la conversione sRGB 0.06 è un grigio chiaro), la sua misura in frazioni
  // del raggio dell'anello, e un giro del lato acceso ogni `coreTurn` secondi
  core: 0.06,
  coreSize: 0.03,
  coreTurn: 120,
  // il nucleo e le comete, lontanissimi, la lente li piega più delle stelle
  // (la deviazione cresce con la distanza della sorgente): il loro anello sta
  // appena fuori dalla sagoma del soggetto
  farLens: 1.16,
};

// la deriva riparte da zero ogni centomila px: per ore il float32 dello
// shader non perde i decimali, e il salto (una volta ogni nove ore) sposta
// tutte le stelle di colpo, quindi passa per un cambio di cielo
const DRIFT_WRAP = 1e5;

// archi in otto spicchi: abbastanza per una curva liscia anche sull'anello
// intero, e i vertici di ogni stella restano 36
const SEGMENTS = 8;

const f = (n: number) => n.toFixed(4);

// --- le stelle e le comete -----------------------------------------------------

const STAR_VERT = /* glsl */ `
uniform vec3 uView;   // larghezza e altezza del canvas in px CSS, dpr
uniform vec3 uLens;   // centro della lente in px CSS dal centro del canvas (y in su), raggio di Einstein
uniform float uDrift; // strada della deriva per lo strato più lento, px CSS
uniform float uTime;  // secondi, per le comete
uniform float uComets; // 0 con reduced motion: una cometa ferma a metà cielo no
attribute float aSeed; // < 1 una stella; 1, 2… una cometa

varying vec2 vTheta;  // il frammento rispetto al centro della lente, px CSS
varying vec4 vSrc;    // la sorgente senza lente: ora (xy) e a inizio scia (zw), px CSS
varying vec4 vLook;   // picco, sigma, tinta, scia (0 stella, 1 cometa)
varying vec2 vLens;   // raggio di Einstein di questa sorgente, lato (1 esterna, -1 interna)

const float PI = 3.14159265;
const vec2 DIR = vec2(${f(SKY.driftDir[0])}, ${f(SKY.driftDir[1])});

// hash senza seno (Dave Hoskins), come in FallingStars
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// le due immagini di una sorgente a distanza x dal centro della lente
float thetaOut(float x, float e) { return 0.5 * (x + sqrt(x * x + 4.0 * e * e)); }
float thetaIn(float x, float e) { return 0.5 * (sqrt(x * x + 4.0 * e * e) - x); }

void main() {
  vec2 halfV = 0.5 * uView.xy;
  vec2 C = uLens.xy;
  float E = uLens.z;
  // la distanza più lunga dal centro della lente a un angolo dello schermo
  float reach = length(halfV + abs(C));
  float px = 1.0 / uView.z;

  vec2 beta;
  vec2 beta0;
  float peak;
  float sig;
  float tint;
  float trail;
  float halo;
  if (aSeed < 1.0) {
    // STELLA: deriva piano in un quadrato attorno alla lente che copre lo
    // schermo, e ne esce da un lato per rientrare dall'altro fuori vista.
    // Tre velocità per la parallasse: le vicine sono più veloci e più chiare
    float layer = hash11(aSeed * 3.71);
    vec2 p0 = (vec2(hash11(aSeed * 11.3), hash11(aSeed * 17.9)) * 2.0 - 1.0) * reach;
    beta = mod(p0 + DIR * uDrift * mix(1.0, 3.0, layer) + reach, 2.0 * reach) - reach;
    beta0 = beta;
    float lum = 0.25 + 0.75 * pow(hash11(aSeed * 5.17), 3.0);
    peak = lum * mix(0.55, 1.0, layer);
    // almeno 1.4 pixel del dispositivo: più sottile una gaussiana sfarfalla,
    // e vicino all'anello la lente la schiaccia ancora di metà
    sig = max(mix(0.5, 0.9, layer), 1.4 * px);
    tint = hash11(aSeed * 9.13);
    trail = 0.0;
    halo = 0.0;
  } else {
    // COMETA: attraversa il cielo nella direzione della deriva, girata di
    // poco, e passa dietro al soggetto a una distanza che cambia a ogni giro.
    // Più vicina al centro passa, più l'anello si chiude
    E *= ${f(SKY.farLens)};
    float idx = floor(aSeed);
    float period = idx < 1.5 ? ${f(SKY.comets[0].period)} : ${f(SKY.comets[1].period)};
    float chance = idx < 1.5 ? ${f(SKY.comets[0].on)} : ${f(SKY.comets[1].on)};
    // la prima passa due secondi e mezzo dopo l'avvio, sempre
    float tt = uTime + period - 2.5 + (idx - 1.0) * 6.0;
    float cyc = floor(tt / period);
    float t = tt - cyc * period;
    float kc = idx * 100.0 + mod(cyc, 1000.0) * 7.77;
    float v = 0.3 * min(uView.x, uView.y);
    float span = 3.0 * E;
    float dur = span / v;
    float ang = (hash11(kc + 1.0) - 0.5) * 0.35;
    vec2 d = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * DIR;
    vec2 n = vec2(-d.y, d.x);
    float impact = (hash11(kc + 2.0) - 0.5) * 0.5 * E;
    float s = v * t - 0.5 * span;
    beta = d * s + n * impact;
    // 0,45 s di scia
    beta0 = d * (s - 0.45 * v) + n * impact;
    float on = smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(dur - 0.5, dur, t));
    if (cyc > 1.5) on *= step(1.0 - chance, hash11(kc + 3.0));
    peak = 1.6 * on * uComets;
    sig = max(1.1, 1.4 * px);
    tint = 1.0;
    trail = 1.0;
    halo = 6.0 * sig;
  }

  // l'impronta della sorgente senza lente: la gaussiana, la scia, l'alone
  float rho = 3.0 * sig + length(beta - beta0) + 5.0 * halo + 1.0;
  float b = length(beta);
  float phi = atan(beta.y, beta.x);
  bool inner = position.z > 0.5;
  // la sorgente copre il centro della lente: le immagini si chiudono ad anello
  bool ring = b <= rho;
  float halfA = ring ? PI : asin(rho / b);
  float rIn;
  float rOut;
  if (inner) {
    rIn = thetaIn(b + rho, E);
    rOut = ring ? E : thetaIn(b - rho, E);
    phi += PI;
    // l'immagine interna è rimpicciolita: sotto una certa misura sarebbe un
    // granello più piccolo del pixel che sfarfalla, quindi si spegne man mano
    float u = b / max(E, 1e-3);
    float mu = 0.5 * ((u * u + 2.0) / (u * sqrt(u * u + 4.0)) - 1.0);
    peak *= smoothstep(0.04, 0.25, mu);
  } else {
    rIn = ring ? E : thetaOut(b - rho, E);
    rOut = thetaOut(b + rho, E);
  }

  // niente da disegnare: spenta, fuori schermo, o immagine interna senza lente
  if (peak < 0.002 || rIn > reach + rho || (inner && E < 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // la striscia ad arco che contiene l'immagine; il bordo esterno va
  // allargato perché le corde degli spicchi tagliano dentro la curva
  float a = phi + (position.x * 2.0 - 1.0) * halfA;
  float rr = position.y > 0.5 ? rOut / cos(halfA / ${f(SEGMENTS)}) : rIn;
  vTheta = rr * vec2(cos(a), sin(a));
  vSrc = vec4(beta, beta0);
  vLook = vec4(peak, sig, tint, trail);
  vLens = vec2(E, inner ? -1.0 : 1.0);
  // sul piano lontano: il soggetto, più vicino, le copre
  gl_Position = vec4((C + vTheta) / halfV, 0.9995, 1.0);
}
`;

const STAR_FRAG = /* glsl */ `
varying vec2 vTheta;
varying vec4 vSrc;
varying vec4 vLook;
varying vec2 vLens;

// in lineare: le stelle vanno dal bianco a un bianco appena freddo
const vec3 COOL = vec3(0.62, 0.74, 1.0);

void main() {
  float E = vLens.x;
  float r = length(vTheta);
  // ogni striscia tiene solo il suo lato della curva critica: dove le due
  // si toccano la stessa luce non va contata due volte
  float keep = vLens.y > 0.0 ? step(E, r) : step(r, E);
  // all'indietro: dove starebbe questo punto senza la lente
  vec2 s = vTheta * (1.0 - E * E / max(r * r, 1e-4));
  // distanza dalla scia (un segmento; per una stella è un punto)
  vec2 a = vSrc.zw;
  vec2 ab = vSrc.xy - a;
  float h = clamp(dot(s - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(s - a - ab * h);
  float sig = vLook.y;
  float trail = vLook.w;
  // la cometa ha testa piena e coda che si spegne, e un alone che la fa luce
  float body = exp(-0.5 * d * d / (sig * sig)) + trail * 0.18 * exp(-d / (6.0 * sig));
  float lum = vLook.x * keep * body * mix(1.0, h * h, trail);
  vec3 col = mix(COOL, vec3(1.0), vLook.z);
  gl_FragColor = vec4(col * lum, lum);
  #include <colorspace_fragment>
}
`;

// per ogni sorgente due strisce (immagine esterna e interna), ognuna di
// SEGMENTS spicchi: position = (posizione lungo l'arco 0..1, bordo 0 interno
// / 1 esterno, immagine 0 esterna / 1 interna)
function makeStrip() {
  const n = SEGMENTS + 1;
  const pos = new Float32Array(2 * n * 2 * 3);
  const index: number[] = [];
  for (let img = 0; img < 2; img++) {
    for (let i = 0; i < n; i++) {
      for (let side = 0; side < 2; side++) {
        pos.set([i / SEGMENTS, side, img], ((img * n + i) * 2 + side) * 3);
      }
      if (i < SEGMENTS) {
        const v = (img * n + i) * 2;
        index.push(v, v + 2, v + 3, v, v + 3, v + 1);
      }
    }
  }
  return { pos, index: new Uint16Array(index) };
}
const STRIP = makeStrip();

// i semi: prima le comete (1, 2…), poi le stelle in sequenza a bassa
// discrepanza, così posizioni e strati si spargono uniformi e ogni
// caricamento ha lo stesso cielo. Le stelle in più restano in fondo e non si
// disegnano: cambiando schermo cambia solo quante se ne disegnano
function makeSeeds(): Float32Array {
  const c = SKY.comets.length;
  const s = new Float32Array(c + SKY.maxStars);
  for (let i = 0; i < c; i++) s[i] = i + 1;
  for (let i = 0; i < SKY.maxStars; i++) s[c + i] = (0.231 + i * 0.6180339887) % 1;
  return s;
}
const SEEDS = makeSeeds();

// --- l'anello ------------------------------------------------------------------

// Il nucleo di una galassia lontana, quasi esattamente dietro al soggetto: la
// lente lo apre in un anello sottile, e altrove non si vede (è dietro). La
// luce cade tutta vicino alla curva critica, quindi si disegna solo una
// corona sottile attorno al soggetto: un passaggio a schermo intero costava
// 2,4-2,9 ms a 2850×1800 su una GPU integrata, la corona ne copre un
// dodicesimo.

// la corona: RING_SEGMENTS spicchi; position = (posizione sul giro 0..1,
// bordo 0 interno / 1 esterno)
const RING_SEGMENTS = 96;
function makeRing() {
  const pos = new Float32Array((RING_SEGMENTS + 1) * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    pos.set([i / RING_SEGMENTS, 0, 0, i / RING_SEGMENTS, 1, 0], i * 6);
    if (i < RING_SEGMENTS) {
      const v = i * 2;
      index.push(v, v + 2, v + 3, v, v + 3, v + 1);
    }
  }
  return { pos, index: new Uint16Array(index) };
}
const RING = makeRing();

const RING_VERT = /* glsl */ `
uniform vec3 uView;
uniform vec3 uLens;
varying vec2 vTheta;

void main() {
  float e = uLens.z * ${f(SKY.farLens)};
  // la luce del nucleo sta entro il 6% del raggio dalla curva critica
  float w = max(0.08 * e, 12.0);
  float a = position.x * 6.2831853;
  vTheta = (e + (position.y * 2.0 - 1.0) * w) * vec2(cos(a), sin(a));
  gl_Position = vec4((uLens.xy + vTheta) / (0.5 * uView.xy), 0.9996, 1.0);
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 uView;
uniform vec3 uLens;
uniform vec2 uCore;   // il nucleo rispetto all'asse della lente, px CSS
varying vec2 vTheta;

void main() {
  float e = uLens.z * ${f(SKY.farLens)};
  float e2 = e * e;
  float r2 = max(dot(vTheta, vTheta), 1e-4);
  // all'indietro: da dove arriva la luce di questo pixel
  vec2 s = vTheta * (1.0 - e2 / r2);
  // il nucleo: una gaussiana di 3 centesimi del raggio, fuori asse di 1,4
  // sigma, così l'anello è circa tre volte più acceso da un lato
  float sig = ${f(SKY.coreSize)} * e;
  vec2 d = s - uCore;
  float src = exp(-0.5 * dot(d, d) / (sig * sig));
  // la lente conserva la luminosità superficiale: qui l'anello si accende un
  // poco dove l'ingrandimento esplode (1 / |1 - (E/r)^4|), come l'anello di
  // fotoni attorno a un buco nero. Licenza poetica, non fisica
  float mu = 1.0 / max(abs(1.0 - e2 * e2 / (r2 * r2)), 1e-3);
  // sotto il menu l'anello si spegne: le voci restano leggibili
  float top = uView.y - gl_FragCoord.y / uView.z;
  float lum = ${f(SKY.core)} * src * clamp(sqrt(mu), 1.0, 4.0) * smoothstep(20.0, 110.0, top);
  gl_FragColor = vec4(vec3(lum), lum);
  #include <colorspace_fragment>
  // un livello di rumore dove c'è luce: la sfumatura lenta su un fondo quasi
  // nero, a 8 bit, farebbe gradini sugli schermi economici
  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5)
    / 255.0 * smoothstep(0.0, 0.01, lum);
}
`;

export default function DeepSpace({
  factor = 1,
  lift = 0,
  lens = 0,
  reduceMotion = false,
}: DeepSpaceProps) {
  const size = useThree((s) => s.size);
  // quante stelle: la densità sull'area del quadrato in cui derivano
  const reach = Math.hypot(size.width / 2, size.height / 2 + Math.abs(lift) * size.height);
  const stars = Math.min(
    SKY.maxStars,
    Math.round(SKY.density * factor * ((2 * reach) ** 2 / 1e6)),
  );
  // vista e lente sono gli stessi oggetti nei due materiali
  const uniforms = useMemo(() => {
    const uView = { value: new THREE.Vector3(1, 1, 1) };
    const uLens = { value: new THREE.Vector3() };
    return {
      stars: {
        uView,
        uLens,
        uDrift: { value: 0 },
        uTime: { value: 0 },
        uComets: { value: 1 },
      },
      ring: { uView, uLens, uCore: { value: new THREE.Vector2() } },
    };
  }, []);
  const starMat = useRef<THREE.ShaderMaterial>(null);
  const ringMat = useRef<THREE.ShaderMaterial>(null);

  useFrame((state, delta) => {
    const us = starMat.current?.uniforms;
    const ur = ringMat.current?.uniforms;
    if (!us || !ur) return;
    // delta limitato: alla ripresa il cielo continua da dov'era
    const dt = reduceMotion ? 0 : Math.min(delta, 0.1);
    us.uTime.value += dt;
    us.uDrift.value = (us.uDrift.value + SKY.drift * dt) % DRIFT_WRAP;
    us.uComets.value = reduceMotion ? 0 : 1;
    const { width: W, height: H } = state.size;
    const E = lens * Math.min(W, H);
    us.uView.value.set(W, H, state.viewport.dpr);
    us.uLens.value.set(0, lift * H, E);
    // il nucleo gira attorno all'asse: il lato acceso dell'anello fa un giro
    // ogni `coreTurn` secondi
    const a = 2.4 + (2 * Math.PI * us.uTime.value) / SKY.coreTurn;
    const off = 1.4 * SKY.coreSize * E * SKY.farLens;
    ur.uCore.value.set(off * Math.cos(a), off * Math.sin(a));
  });

  return (
    <>
      {/* l'anello: luce che si somma, sul piano lontano dietro al soggetto */}
      <mesh frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[RING.pos, 3]} />
          <bufferAttribute attach="index" args={[RING.index, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={ringMat}
          vertexShader={RING_VERT}
          fragmentShader={RING_FRAG}
          uniforms={uniforms.ring}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          premultipliedAlpha
          toneMapped={false}
        />
      </mesh>
      <mesh frustumCulled={false}>
        {/* le comete sempre (i primi semi), le stelle quante ne servono */}
        <instancedBufferGeometry instanceCount={SKY.comets.length + stars}>
          <bufferAttribute attach="attributes-position" args={[STRIP.pos, 3]} />
          <bufferAttribute attach="index" args={[STRIP.index, 1]} />
          <instancedBufferAttribute attach="attributes-aSeed" args={[SEEDS, 1]} />
        </instancedBufferGeometry>
        {/* a doppia faccia: le strisce girano in senso orario o antiorario a
            seconda di dove cade l'arco, e nessuna deve essere scartata */}
        <shaderMaterial
          ref={starMat}
          vertexShader={STAR_VERT}
          fragmentShader={STAR_FRAG}
          uniforms={uniforms.stars}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          premultipliedAlpha
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

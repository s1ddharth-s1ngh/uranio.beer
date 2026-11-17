import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Stelle cadenti: uno sciame meteorico dietro al soggetto, un solo draw call.
// Disegnato in spazio schermo (px CSS) e non nel mondo: non dipende dalla
// camera né dal puntatore, quindi si monta uguale in qualunque <Canvas>. Il
// tempo è la somma dei delta di useFrame: funziona anche con
// frameloop="never" e advance() a mano. Piano e scelte: docs/STELLE_CADENTI.md

interface FallingStarsProps {
  // densità dello sciame: 1 = desktop. HeroScene passa lo starFactor del
  // campo stellare (mobile 0.55, tablet 0.8)
  factor?: number;
}

// Taratura. Velocità in diagonali del canvas al secondo: una meteora
// attraversa la stessa fetta di cielo su telefono e su desktop. Spessori e
// aloni (nello shader) in px CSS: una linea di un pixel resta di un pixel.
const SKY = {
  // meteore normali a densità 1; il bolide è uno solo, sempre
  slots: 7,
  // ogni slot si ripete con un periodo suo (s) e ogni giro è una meteora
  // nuova; una parte dei giri resta vuota, così il ritmo non batte. Con
  // questi numeri: ~0,8 meteore al secondo, in media una visibile alla volta
  periodMin: 3.5,
  periodMax: 8,
  skip: 0.35,
  bolidePeriod: 9,
  bolideSkip: 0.4,
  // il radiante, il punto da cui "piove" lo sciame: direzione dal centro e
  // distanza in diagonali. In alto a destra, fuori schermo: le meteore si
  // aprono a ventaglio verso il basso a sinistra, verso il titolo
  radiantDir: [0.8, 0.6],
  radiantDist: 1.1,
  speedMin: 0.3,
  speedMax: 0.6,
};

// il tempo dello shader riparte da zero ogni WRAP secondi: in float32 un
// tempo che cresce per ore perde i decimali e le meteore avanzano a scatti.
// Ogni periodo è WRAP/n con n intero, così al giro nessuna meteora salta
const WRAP = 720;

const f = (n: number) => n.toFixed(4);

const VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uView;   // larghezza e altezza del canvas in px CSS, dpr
attribute vec3 aSlot; // seme, tipo (1 = bolide), periodo

varying vec2 vPos;    // dal centro della testa, px CSS: x lungo la corsa, y di lato
varying vec2 vScr;    // dal centro della testa, px CSS, assi dello schermo
varying vec4 vRun;    // t nel giro, durata, velocità (px/s), tau della scia
varying vec4 vLook;   // luminosità, spessore, alone, punte
varying vec3 vMisc;   // parte (0 scia, 1 testa), strada fatta dalla testa, lampo

// hash senza seno (Dave Hoskins): fract(sin()) si ripete a righe sulle GPU
// che calcolano il seno a bassa precisione
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  float seed = aSlot.x;
  bool bolide = aSlot.y > 0.5;
  float period = aSlot.z;
  bool head = position.z > 0.5;

  float tt = uTime + seed * period;
  float cycle = floor(tt / period);
  float t = tt - cycle * period;
  // il giro contato modulo i giri in un WRAP: quando il tempo riparte da
  // zero la meteora in volo resta la stessa
  float k = seed * 1000.0 + mod(cycle, floor(${f(WRAP)} / period + 0.5)) * 17.31;

  // magnitudine: tante deboli, poche brillanti (la distribuzione vera)
  float m = bolide ? 1.0 : pow(hash11(k + 1.0), 1.7);
  float dur = bolide ? mix(1.1, 1.4, hash11(k + 2.0))
                     : mix(0.5, 0.9, hash11(k + 2.0)) + 0.5 * m;
  float tau = bolide ? 0.35 : mix(0.12, 0.32, m);
  bool empty = hash11(k + 3.0) < (bolide ? ${f(SKY.bolideSkip)} : ${f(SKY.skip)});

  // fuori dal clip, nessun frammento: giro vuoto, scia spenta, testa consumata
  if (empty || t > dur + 5.0 * tau || (head && t > dur)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 halfV = 0.5 * uView.xy;
  float diag = length(uView.xy);
  // il punto di mezzo della corsa, ovunque nel cielo. Se cade dietro al
  // soggetto centrale si tira una seconda volta: dietro non si vedrebbe
  vec2 mid = (vec2(hash11(k + 4.0), hash11(k + 5.0)) * 2.0 - 1.0) * halfV * 1.1;
  if (length(mid) < 0.36 * min(uView.x, uView.y)) {
    mid = (vec2(hash11(k + 6.0), hash11(k + 7.0)) * 2.0 - 1.0) * halfV * 1.1;
  }

  vec2 radiant = vec2(${f(SKY.radiantDir[0])}, ${f(SKY.radiantDir[1])}) * ${f(SKY.radiantDist)} * diag;
  // il bolide è il momento raro e va visto tutto, lampo compreso: corsa
  // fissa e fino a otto tentativi per una che resti fuori dal soggetto, con
  // il lampo dentro lo schermo. Se nessuno riesce si tiene l'ultimo
  float lenB = 0.3 * diag;
  if (bolide) {
    float keepB = 0.42 * min(uView.x, uView.y);
    for (int i = 0; i < 8; i++) {
      vec2 cand = (vec2(hash11(k + 11.0 + float(i)), hash11(k + 31.0 + float(i))) * 2.0 - 1.0)
                * halfV * 0.85;
      vec2 d = normalize(cand - radiant);
      bool ok = all(lessThan(abs(cand + d * lenB * 0.36), halfV - 40.0));
      for (int j = 0; j < 4; j++) {
        ok = ok && length(cand + d * lenB * (mix(0.1, 0.86, float(j) / 3.0) - 0.5)) > keepB;
      }
      mid = cand;
      if (ok) break;
    }
  }
  vec2 dir = normalize(mid - radiant);
  vec2 nrm = vec2(-dir.y, dir.x);
  // vicino al radiante le meteore vengono incontro: più corte e più lente.
  // E le deboli, che sono le lontane, corrono meno delle vicine: profondità
  float fore = mix(0.6, 1.0, clamp(length(mid - radiant) / (1.8 * diag), 0.0, 1.0));
  float v = bolide ? lenB / dur
                   : diag * mix(${f(SKY.speedMin)}, ${f(SKY.speedMax)}, hash11(k + 8.0)) * fore
                     * mix(0.75, 1.15, m);
  vec2 start = mid - dir * (0.5 * v * dur);
  float sh = v * min(t, dur);

  float w = bolide ? 1.5 : mix(0.6, 1.25, m);
  float halo = bolide ? 9.0 : mix(2.5, 7.0, m);
  float spikes = bolide ? 36.0 : 24.0 * smoothstep(0.6, 1.0, m);
  float flare = bolide ? 1.3 : 0.8 * smoothstep(0.6, 1.0, m);
  float bright = bolide ? 1.0 : mix(0.5, 1.0, m);

  vec2 c = position.xy;
  vec2 p;
  if (head) {
    // quadrato allineato allo schermo: le punte del lampo sono verticale e
    // orizzontale come quelle di un obiettivo. Abbastanza grande per l'alone
    // gonfiato dal lampo, o la sfumatura dei bordi lo taglierebbe a disco
    float hs = max(6.0 * halo * (1.0 + 0.5 * flare), spikes) + 2.0;
    vScr = vec2(2.0 * c.x - 1.0, c.y) * hs;
    p = start + dir * sh + vScr;
    vPos = vec2(dot(vScr, dir), dot(vScr, nrm));
  } else {
    // la scia copre solo il tratto ancora acceso (oltre 5 tau è spenta) e
    // sporge di mezza larghezza oltre la testa: lì il fragment la chiude con
    // un cappuccio tondo invece di un taglio dritto
    float hw = 7.0 * w + 2.0;
    float s = mix(max(0.0, sh - 5.0 * v * tau), sh + hw, c.x);
    vScr = vec2(0.0);
    p = start + dir * s + nrm * (c.y * hw);
    vPos = vec2(s - sh, c.y * hw);
  }

  vRun = vec4(t, dur, v, tau);
  vLook = vec4(bright, w, halo, spikes);
  vMisc = vec3(position.z, sh, flare);
  // sul piano lontano: il soggetto, più vicino, le copre
  gl_Position = vec4(p / halfV, 0.9995, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uView;

varying vec2 vPos;
varying vec2 vScr;
varying vec4 vRun;
varying vec4 vLook;
varying vec3 vMisc;

// in lineare: la scia che si spegne vira appena al freddo, il filo di blu
// che il cromo del logo ha nei bui. È l'unico colore oltre al bianco
const vec3 COOL = vec3(0.5, 0.64, 1.0);

// la luminosità della testa lungo la vita (x: 0 innesco, 1 fine): si accende,
// cresce un poco e si consuma; le brillanti fanno un lampo prima di finire
float glow(float x, float flare) {
  x = clamp(x, 0.0, 1.0);
  float b = smoothstep(0.0, 0.2, x) * (1.0 - smoothstep(0.8, 1.0, x)) * (0.65 + 0.35 * x);
  float q = (x - 0.86) / 0.045;
  return b + flare * exp(-q * q);
}

void main() {
  float t = vRun.x;
  float dur = vRun.y;
  float v = vRun.z;
  float tau = vRun.w;
  float bright = vLook.x;
  float w = vLook.y;
  float halo = vLook.z;
  float spikes = vLook.w;
  float flare = vMisc.z;
  // spessore minimo, in px CSS: sotto i 0.7 pixel del dispositivo una linea
  // gaussiana cade tra due pixel e sfarfalla. La si allarga e la si attenua
  // in proporzione, così porta la stessa luce
  float minSig = 0.7 / uView.z;

  vec3 col;
  float lum;
  if (vMisc.x < 0.5) {
    // SCIA: ogni punto si è acceso quando la testa ci è passata, con la luce
    // che la testa aveva in quell'istante, e da lì si spegne col suo tempo.
    // Oltre la testa (vPos.x > 0) conta la distanza dal suo centro: è il
    // cappuccio tondo, con la luce che la testa ha adesso
    float s = min(vPos.x, 0.0) + vMisc.y;
    float age = max(t - s / v, 0.0);
    // a zero esatto entro 5 tau: dopo la conversione sRGB anche lo 0,5% di
    // luce residua disegnerebbe il bordo del quad
    float fade = exp(-age / tau) * (1.0 - smoothstep(3.0, 5.0, age / tau));
    float sig = w * mix(0.4, 1.0, fade);
    float sigE = max(sig, minSig);
    float ahead = max(vPos.x, 0.0);
    float y2 = vPos.y * vPos.y + ahead * ahead;
    float core = sig / sigE * exp(-0.5 * y2 / (sigE * sigE));
    float wide = 0.05 * exp(-0.5 * y2 / (16.0 * sigE * sigE));
    float edge = 1.0 - smoothstep(0.7, 1.0, sqrt(y2) / (7.0 * w + 2.0));
    lum = bright * glow(s / (v * dur), flare) * fade * (core + wide) * edge;
    col = mix(COOL, vec3(1.0), fade);
  } else {
    // TESTA: nucleo, alone, e durante il lampo le quattro punte. Il lampo
    // gonfia il nucleo e accende le punte; l'alone cresce poco, se no il
    // cielo attorno diventa nebbia
    float r = length(vPos);
    float x = t / dur;
    float q = (x - 0.86) / 0.045;
    float flash = flare * exp(-q * q);
    float b = glow(x, 0.0);
    float sigE = max(1.3 * w, minSig);
    float core = (b + flash) * exp(-0.5 * r * r / (sigE * sigE));
    float aura = 0.3 * (b + 0.4 * flash) * exp(-r / (halo * (1.0 + 0.5 * flash)));
    vec2 a = abs(vScr);
    float th = max(0.6, minSig);
    float len = 0.22 * max(spikes, 1.0);
    float star = exp(-a.x / len) * exp(-0.5 * a.y * a.y / (th * th))
               + exp(-a.y / len) * exp(-0.5 * a.x * a.x / (th * th));
    float hs = max(6.0 * halo * (1.0 + 0.5 * flare), spikes) + 2.0;
    float edge = 1.0 - smoothstep(0.6, 1.0, length(vScr) / hs);
    lum = bright * (core + aura + flash * star * step(1.0, spikes)) * edge;
    col = vec3(1.0);
  }
  gl_FragColor = vec4(col * lum, lum);
  #include <colorspace_fragment>
}
`;

// due quad per meteora, la scia (z = 0) e la testa (z = 1); x lungo la corsa
// (0 coda, 1 testa), y di lato. Il vertex shader li stira e li sposta
const QUAD = new Float32Array([
  0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0,
  0, -1, 1, 1, -1, 1, 1, 1, 1, 0, 1, 1,
]);
const INDEX = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);

// semi deterministici (sequenze a bassa discrepanza, non Math.random): le fasi
// si spargono uniformi e ogni caricamento ha lo stesso cielo, comodo per le
// verifiche fotogramma per fotogramma
function makeSlots(count: number): Float32Array {
  const slots = new Float32Array((count + 1) * 3);
  for (let i = 0; i <= count; i++) {
    const bolide = i === count;
    const seed = (0.137 + i * 0.6180339887) % 1;
    const wanted = bolide
      ? SKY.bolidePeriod
      : SKY.periodMin +
        ((0.71 + i * 0.7548776662) % 1) * (SKY.periodMax - SKY.periodMin);
    slots.set([seed, bolide ? 1 : 0, WRAP / Math.round(WRAP / wanted)], i * 3);
  }
  return slots;
}

export default function FallingStars({ factor = 1 }: FallingStarsProps) {
  const count = Math.max(3, Math.round(SKY.slots * factor));
  const slots = useMemo(() => makeSlots(count), [count]);
  // l'oggetto iniziale degli uniform; per frame si aggiornano dal materiale
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uView: { value: new THREE.Vector3(1, 1, 1) },
    }),
    [],
  );
  const material = useRef<THREE.ShaderMaterial>(null);

  useFrame((state, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    // delta limitato: alla ripresa dopo una pausa (hero fuori vista, tab in
    // secondo piano) il cielo riprende da dov'era invece di saltare avanti
    u.uTime.value = (u.uTime.value + Math.min(delta, 0.1)) % WRAP;
    u.uView.value.set(state.size.width, state.size.height, state.viewport.dpr);
  });

  return (
    // la geometria è un quad fittizio che lo shader sposta: i bound di three
    // non valgono, niente frustum culling
    <mesh frustumCulled={false}>
      <instancedBufferGeometry instanceCount={count + 1}>
        <bufferAttribute attach="attributes-position" args={[QUAD, 3]} />
        <bufferAttribute attach="index" args={[INDEX, 1]} />
        <instancedBufferAttribute attach="attributes-aSlot" args={[slots, 3]} />
      </instancedBufferGeometry>
      {/* luce che si somma: l'ordine col campo stellare non conta, e senza
          scrittura di profondità le scie non si coprono tra loro */}
      <shaderMaterial
        ref={material}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        premultipliedAlpha
        toneMapped={false}
      />
    </mesh>
  );
}

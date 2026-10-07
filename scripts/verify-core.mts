// Verifica dei moduli `src/core/` in Node, senza browser.
//
// È lo stesso metodo del task 8.4 (`verify-glb.mts`) applicato alla logica:
// le classi di `core/` sono TypeScript puro fuori da React proprio perché si
// possano eseguire qui. Le parti che toccano `window` (ascoltatori di resize,
// eventi di rotella) restano fuori: quello che si prova è la matematica.
//
//   npm run verify:core

import assert from "node:assert/strict";
import gsap from "gsap";
import {
  computeViewport,
  DPR_CAP,
  MOBILE_MAX_WIDTH,
} from "../src/core/Viewport.ts";
import { durationFor, Progress } from "../src/core/Progress.ts";
import {
  keyIntent,
  swipeDirection,
  WheelGesture,
} from "../src/core/StepController.ts";
import { SCROLL, STEP_DURATION } from "../src/config/theme.ts";
import { StateMapper } from "../src/core/StateMapper.ts";
import { KEYFRAMES, SEGMENTS } from "../src/config/keyframes.ts";
import { BANDS, BOTTLE, SHADER } from "../src/config/bottle.ts";

// --- viewport: tetto al DPR e breakpoint
{
  const desktop = computeViewport(1440, 900, 2);
  assert.equal(desktop.mobile, false);
  assert.equal(desktop.dpr, DPR_CAP.desktop, "DPR desktop non limitato");
  assert.equal(desktop.aspect, 1.6);

  const mobile = computeViewport(390, 844, 3);
  assert.equal(mobile.mobile, true);
  assert.equal(mobile.dpr, DPR_CAP.mobile, "DPR mobile non limitato");

  // un DPR già basso non va alzato né abbassato sotto 1
  assert.equal(computeViewport(1440, 900, 1).dpr, 1);
  assert.equal(computeViewport(1440, 900, 0.8).dpr, 1, "DPR sotto il pixel reale");

  // il breakpoint è esclusivo: 768 è già desktop (tablet verticale, spec 8.23)
  assert.equal(computeViewport(MOBILE_MAX_WIDTH, 1024, 2).mobile, false);
  assert.equal(computeViewport(MOBILE_MAX_WIDTH - 1, 1024, 2).mobile, true);

  // altezza 0 durante il primo frame di certi browser: niente divisione per 0
  assert.equal(computeViewport(1440, 0, 2).aspect, 1);
}

// --- gesti di rotella: una spinta = uno step
{
  // trackpad: una spinta sola, decine di eventi che calano a 16 ms l'uno
  const g = new WheelGesture();
  let t = 1000;
  let step = 0;
  for (const d of [8, 24, 40, 36, 30, 22, 14, 9, 5, 3, 2, 1]) {
    step += g.feed(d, 0, (t += 16), 900);
  }
  assert.equal(step, 1, "una spinta di trackpad deve fare un solo step");

  // la coda dell'inerzia non deve far scattare il secondo step…
  for (const d of [1, 1, 0.5]) step += g.feed(d, 0, (t += 16), 900);
  assert.equal(step, 1, "l'inerzia ha fatto scattare uno step in più");

  // …ma una seconda spinta dentro la coda sì: accelera, quindi è intenzione
  step += g.feed(40, 0, (t += 16), 900);
  assert.equal(step, 2, "la seconda spinta non è stata riconosciuta");

  // mouse a tacche: un evento secco per tacca, con pause lunghe
  const m = new WheelGesture();
  let tacche = 0;
  for (let i = 0; i < 3; i++) tacche += m.feed(100, 0, 1000 + i * 400, 900);
  assert.equal(tacche, 3, "ogni tacca del mouse deve fare uno step");

  // righe e pagine vanno normalizzate (regola 5.1.2): 2 righe = 32 px
  const r = new WheelGesture();
  assert.equal(r.feed(2, 1, 5000, 900), 1, "deltaMode 1 non normalizzato");
  const pg = new WheelGesture();
  assert.equal(pg.feed(1, 2, 5000, 900), 1, "deltaMode 2 non normalizzato");

  // sotto la soglia non succede niente: un filo di trackpad non è un gesto
  const q = new WheelGesture();
  assert.equal(q.feed(SCROLL.triggerPx - 1, 0, 6000, 900), 0);
  assert.equal(q.feed(-1, 0, 6016, 900), 0, "accumulo in direzioni opposte");
}

// --- swipe e tastiera
{
  assert.equal(swipeDirection(-80, 300), 1, "swipe verso l'alto = avanti");
  assert.equal(swipeDirection(80, 300), -1, "swipe verso il basso = indietro");
  assert.equal(swipeDirection(-10, 500), 0, "trascinamento corto e lento");
  // flick corto ma veloce: 20 px in 30 ms = 0,66 px/ms, sopra la soglia
  assert.equal(swipeDirection(-20, 30), 1, "flick veloce non riconosciuto");
  assert.equal(swipeDirection(0, 0), 0, "tocco fermo");

  assert.deepEqual(keyIntent("ArrowDown", false), { dir: 1 });
  assert.deepEqual(keyIntent("PageUp", false), { dir: -1 });
  assert.deepEqual(keyIntent(" ", false), { dir: 1 });
  assert.deepEqual(keyIntent(" ", true), { dir: -1 }, "Maiusc+Spazio = indietro");
  assert.deepEqual(keyIntent("Home", false), { to: "first" });
  assert.deepEqual(keyIntent("End", false), { to: "last" });
  assert.equal(keyIntent("a", false), null);
}

// --- durate (spec 5.2 e regola 5.1.7)
{
  assert.equal(durationFor(0, 1), STEP_DURATION[0]);
  assert.equal(durationFor(2, 3), STEP_DURATION[2]);
  // mezzo segmento in meno di tempo: la velocità percepita resta la stessa
  assert.equal(durationFor(0.5, 1), STEP_DURATION[0] * 0.5);
  // salto di 2: base + un extra
  assert.equal(durationFor(0, 2), STEP_DURATION[0] + SCROLL.jumpExtraPerStep);
  // salto lungo: il tetto
  assert.equal(durationFor(0, 6), SCROLL.jumpMaxDuration);
  assert.equal(durationFor(0, 1, true), 0.45, "reduced motion ignorata");
}

// --- Progress: il motore vero, con il tempo guidato a mano
{
  // `lagSmoothing(0)`: senza, GSAP compensa i salti di tempo del seek e le
  // durate non tornano
  gsap.ticker.lagSmoothing(0);
  const avanza = (dt: number) =>
    gsap.globalTimeline.time(gsap.globalTimeline.time() + dt);

  const pr = new Progress();
  const leave: string[] = [];
  const enter: number[] = [];
  pr.addEventListener("step:leave", (e) => {
    const d = (e as CustomEvent<{ from: number; to: number }>).detail;
    leave.push(`${d.from}>${d.to}`);
  });
  pr.addEventListener("step:enter", (e) =>
    enter.push((e as CustomEvent<{ step: number }>).detail.step),
  );

  assert.equal(pr.p, 0);
  assert.equal(pr.moving, false);

  // avanti di uno
  pr.request(1, 1);
  assert.equal(pr.target, 1);
  assert.equal(pr.moving, true);
  assert.deepEqual(leave, ["0>1"]);

  // a metà corsa, un gesto nello stesso verso si ignora (regola 5.1.4)
  avanza(STEP_DURATION[0] / 2);
  const meta = pr.p;
  assert(meta > 0 && meta < 1, `p a metà corsa: ${meta}`);
  pr.request(2, 1);
  assert.equal(pr.target, 1, "un gesto in avanti ha scavalcato la transizione");

  // un gesto nel verso opposto inverte subito, ripartendo da dove si è
  pr.request(0, -1);
  assert.equal(pr.target, 0);
  assert.deepEqual(leave, ["0>1", "1>0"]);
  avanza(STEP_DURATION[0]);
  assert.equal(pr.p, 0, "l'inversione non è arrivata a destinazione");
  assert.deepEqual(enter, [0]);
  assert.equal(pr.moving, false);

  // contro il bordo: `p` esce di un filo e torna, il target non cambia
  pr.request(-1, -1);
  assert.equal(pr.target, 0);
  avanza(SCROLL.bounceDuration / 2);
  assert(pr.p < 0, `il rimbalzo non è uscito dal bordo: ${pr.p}`);
  assert(pr.p >= -SCROLL.bounceAmount - 1e-9, "il rimbalzo è andato troppo oltre");
  avanza(SCROLL.bounceDuration / 2 + 0.01);
  assert.equal(pr.p, 0, "il rimbalzo non è rientrato");
  assert.deepEqual(enter, [0], "il rimbalzo ha emesso uno step:enter");

  // salto con l'icona: parte anche a transizione in corso e passa dagli
  // step intermedi senza fermarsi
  pr.goTo(4);
  avanza(0.2);
  pr.goTo(2);
  assert.equal(pr.target, 2);
  avanza(SCROLL.jumpMaxDuration);
  assert.equal(pr.p, 2);
  assert.deepEqual(enter, [0, 2]);

  // oltre i bordi non si va
  pr.goTo(99);
  assert.equal(pr.target, pr.last);
  pr.jump(-5);
  assert.equal(pr.p, 0);
  assert.equal(pr.moving, false, "jump() ha lasciato un tween in corso");
  pr.dispose();
}

// --- StateMapper: lo stato è una funzione pura di `p`
{
  const desktop = computeViewport(1440, 900, 2);
  const sm = new StateMapper(desktop);
  assert.equal(sm.last, KEYFRAMES.length - 1);
  assert.equal(SEGMENTS.length, sm.last, "un segmento per ogni passaggio");

  // sugli interi lo stato è esattamente il keyframe
  for (let i = 0; i <= sm.last; i++) {
    const s = sm.apply(i);
    const k = KEYFRAMES[i];
    assert.deepEqual(
      s.camera.position.toArray().map((n) => +n.toFixed(6)),
      k.camera.position.map((n) => +n.toFixed(6)),
      `camera allo step ${i}`,
    );
    assert.deepEqual(
      [s.rotation.x, s.rotation.y, s.rotation.z].map((n) => +n.toFixed(6)),
      k.rotation.map((n) => +n.toFixed(6)),
      `rotazione allo step ${i}`,
    );
    assert.equal(s.uniforms.focus, k.focus, `focus allo step ${i}`);
    assert.equal(s.uniforms.reveal, k.reveal, `reveal allo step ${i}`);
    assert.equal(s.spot, k.spot, `spot allo step ${i}`);
    assert.equal(s.background.hero, k.background[0]);
    assert.equal(s.background.step, k.background[1]);
    assert.equal(s.background.finale, k.background[2]);
    // nelle pause la lama di luce è spenta e parcheggiata fuori campo
    assert.equal(s.uniforms.sweepAmt, 0, `lama accesa in pausa allo step ${i}`);
    assert.equal(s.uniforms.sweep, SHADER.sweepIdle);
  }

  // i pivot risolti dalle ancore: la tabella 7.2 dà i valori attesi a 16:10
  const pivot = (p: number) => {
    const v = sm.apply(p).pivot;
    return [v.x, v.y, v.z].map((n) => +n.toFixed(2));
  };
  console.log("pivot desktop:", [0, 1, 2, 3, 4, 5, 6].map((i) => pivot(i)));

  // la cima della bottiglia allo step 1 deve finire al 14% dall'alto: se il
  // pivot è giusto, il punto ancorato ricade dove dice il keyframe. Qui si
  // verifica la proprietà, non il numero: è la proprietà che regge su ogni
  // formato (spec 7.1).
  for (const vp of [computeViewport(1440, 900, 2), computeViewport(2560, 1080, 1), computeViewport(390, 844, 3)]) {
    const m = new StateMapper(vp);
    for (let i = 0; i <= m.last; i++) {
      const s = m.apply(i);
      const kf = (vp.mobile ? "mobile" : "desktop") + " step " + i;
      // ricostruzione: punto ancorato = pivot + offset ruotato
      const off = new (await import("three")).Vector3(0, (vp.mobile ? KEYFRAMES : KEYFRAMES)[i].anchor.localY, 0).applyEuler(s.rotation);
      const mondo = s.pivot.clone().add(off);
      const cam = new (await import("three")).PerspectiveCamera(28, vp.aspect, 0.1, 100);
      cam.position.copy(s.camera.position);
      cam.lookAt(s.camera.look);
      cam.updateMatrixWorld(true);
      const ndc = mondo.clone().project(cam);
      const schermo = [(ndc.x + 1) / 2, (1 - ndc.y) / 2];
      const atteso = (vp.mobile ? await import("../src/config/keyframes.ts").then((m) => m.KEYFRAMES_MOBILE) : KEYFRAMES)[i].anchor.screen;
      assert(
        Math.abs(schermo[0] - atteso[0]) < 1e-3 && Math.abs(schermo[1] - atteso[1]) < 1e-3,
        `${kf}: l'ancora cade a ${schermo.map((n) => n.toFixed(3))} invece di ${atteso}`,
      );
    }
  }

  // nessun salto fra la fine di un segmento e l'inizio del successivo
  for (let i = 1; i < sm.last; i++) {
    const prima = { ...sm.apply(i - 1e-4).uniforms };
    const pPrima = sm.apply(i - 1e-4).pivot.clone();
    const dopo = { ...sm.apply(i + 1e-4).uniforms };
    const pDopo = sm.apply(i + 1e-4).pivot.clone();
    assert(
      pPrima.distanceTo(pDopo) < 1e-2,
      `salto del pivot al confine ${i}: ${pPrima.distanceTo(pDopo)}`,
    );
    for (const key of ["reveal", "focus", "focusY", "focusHalf"] as const) {
      assert(
        Math.abs(prima[key] - dopo[key]) < 1e-2,
        `salto di ${key} al confine ${i}: ${prima[key]} → ${dopo[key]}`,
      );
    }
  }

  // la bottiglia gira sempre nello stesso verso: 0 → π → 2π, mai indietro
  let ultima = -Infinity;
  for (let p = 0; p <= sm.last; p += 0.05) {
    const y = sm.apply(p).rotation.y;
    assert(y >= ultima - 1e-9, `la rotazione torna indietro a p=${p.toFixed(2)}`);
    ultima = y;
  }
  assert(Math.abs(sm.apply(sm.last).rotation.y - Math.PI * 2) < 1e-9);

  // la lama di luce vive solo dentro la transizione e tocca il massimo a metà
  {
    const meta = sm.apply(0.6).uniforms;
    assert(meta.sweepAmt > 0.9, `la lama non si accende: ${meta.sweepAmt}`);
    assert(meta.sweep > SHADER.sweepFrom && meta.sweep < SHADER.sweepTo);
    // nei segmenti fra le fasce è volutamente più timida
    assert(sm.apply(2.5).uniforms.sweepAmt <= SEGMENTS[2].sweepAmt + 1e-9);
  }

  // le finestre sfalsano davvero: a metà del primo segmento le laterali sono
  // già fuori e la maschera della cima non è ancora partita
  {
    const s = sm.apply(0.5);
    assert.equal(s.carousel.escape, 1, "le laterali non sono ancora uscite");
    assert.equal(s.props, 1, "faro e piedistallo non sono ancora usciti");
    assert(s.uniforms.reveal > 0 && s.uniforms.reveal < 0.3, `reveal a metà: ${s.uniforms.reveal}`);
  }

  // il rimbalzo ai bordi deve **vedersi**: `p` sotto zero extrapola
  {
    const fermo = sm.apply(0).pivot.clone();
    const rimbalzo = sm.apply(-SCROLL.bounceAmount);
    assert(
      fermo.distanceTo(rimbalzo.pivot) > 1e-4,
      "il rimbalzo non muove nulla: lo stato è congelato sotto zero",
    );
  }

  // le fasce dell'etichetta coincidono con le ancore degli step 2–5
  for (const [i, b] of [BANDS.f1, BANDS.f2, BANDS.f3, BANDS.f4].entries()) {
    const s = sm.apply(i + 2);
    assert.equal(+s.uniforms.focusY.toFixed(6), +b.y.toFixed(6));
    assert.equal(
      +KEYFRAMES[i + 2].anchor.localY.toFixed(6),
      +(b.y - BOTTLE.centerY).toFixed(6),
      `l'ancora dello step ${i + 2} non è la sua fascia`,
    );
  }
  // e salgono di step in step, raddrizzandosi (spec 7.2)
  for (let i = 2; i < 5; i++) {
    assert(
      sm.apply(i + 1).pivot.y > sm.apply(i).pivot.y,
      `la bottiglia non sale dallo step ${i} al ${i + 1}`,
    );
    assert(
      Math.abs(KEYFRAMES[i + 1].rotation[2]) < Math.abs(KEYFRAMES[i].rotation[2]),
      `la bottiglia non si raddrizza dallo step ${i} al ${i + 1}`,
    );
  }
}

console.log("verify-core: OK");

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
import { durationFor, Progress, reducedPose } from "../src/core/Progress.ts";
import {
  edgeAction,
  type EdgeState,
  keyBelongsToFocus,
  keyIntent,
  swipeDirection,
  WheelGesture,
} from "../src/core/StepController.ts";
import { SCROLL, STEP_DURATION } from "../src/config/theme.ts";
import { keyframesFor, StateMapper } from "../src/core/StateMapper.ts";
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

  // il breakpoint del telefono è esclusivo: a 768 non è più un telefono
  assert.equal(computeViewport(MOBILE_MAX_WIDTH, 1024, 2).mobile, false);
  assert.equal(computeViewport(MOBILE_MAX_WIDTH - 1, 1024, 2).mobile, true);
  // ma il tablet verticale si compone come un telefono (spec 8.23): il layout
  // lo decide `portrait`, il DPR resta quello della larghezza
  {
    const tablet = computeViewport(MOBILE_MAX_WIDTH, 1024, 2);
    assert.equal(tablet.portrait, true, "768×1024 non è verticale");
    assert.equal(tablet.dpr, DPR_CAP.desktop);
    // il quadrato è verticale come in `(max-aspect-ratio: 1/1)`
    assert.equal(computeViewport(1000, 1000, 1).portrait, true);
    assert.equal(computeViewport(1024, 768, 2).portrait, false, "tablet orizzontale = desktop");
  }

  // altezza 0 durante il primo frame di certi browser: niente divisione per 0
  assert.equal(computeViewport(1440, 0, 2).aspect, 1);
}

// --- DPR adattivo (spec 6.1, task 8.27): tempi finti, frame per frame
{
  const { AdaptiveDpr } = await import("../src/core/AdaptiveDpr.ts");
  const { ADAPTIVE_DPR } = await import("../src/config/theme.ts");
  // `secondi` di frame lunghi `ms`; restituisce il DPR a fine corsa
  const gira = (a: InstanceType<typeof AdaptiveDpr>, dpr: number, ms: number, secondi: number) => {
    for (let t = 0; t < secondi; t += ms / 1000) dpr = a.feed(ms / 1000, dpr) ?? dpr;
    return dpr;
  };
  const W = ADAPTIVE_DPR.warmup;

  // nessun campione durante il riscaldamento, per quanto lenti siano i frame
  const intro = new AdaptiveDpr();
  assert.equal(gira(intro, 1.75, 100, W - 0.2), 1.75, "il DPR scende mentre compilano gli shader");

  // sotto soglia non scende mai
  const veloce = new AdaptiveDpr();
  assert.equal(gira(veloce, 1.75, 16.7, W + 20), 1.75, "a 60 fps il DPR è sceso");
  assert.equal(gira(new AdaptiveDpr(), 1.75, 19.5, W + 20), 1.75, "appena sotto i 20 ms è sceso");

  // 2 s sopra soglia: un gradino da 0,25, non di più
  const lenta = new AdaptiveDpr();
  gira(lenta, 1.75, 25, W);
  assert.equal(gira(lenta, 1.75, 25, ADAPTIVE_DPR.window - 0.1), 1.75, "è sceso prima dei 2 s");
  assert.equal(gira(lenta, 1.75, 25, 0.2), 1.5, "2 s sopra soglia non hanno fatto scendere di 0,25");

  // e mai sotto 1, per quanto a lungo resti lenta
  assert.equal(gira(new AdaptiveDpr(), 1.75, 40, W + 60), ADAPTIVE_DPR.min, "il DPR è andato sotto 1");

  // dopo un resize il riscaldamento riparte
  lenta.reset();
  assert.equal(gira(lenta, 1.75, 40, W - 0.2), 1.75, "il reset non riavvia il riscaldamento");
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

// --- la tastiera non ruba i tasti ai controlli (task 8.24)
{
  assert.equal(keyBelongsToFocus(" ", "controllo"), true, "lo Spazio su un bottone lo preme");
  assert.equal(keyBelongsToFocus("ArrowDown", "controllo"), false, "le frecce restano all'esperienza");
  assert.equal(keyBelongsToFocus("End", "controllo"), false);
  assert.equal(keyBelongsToFocus(" ", null), false, "senza fuoco lo Spazio fa uno step");
  assert.equal(keyBelongsToFocus("ArrowDown", "testo"), true, "in un campo tutti i tasti sono suoi");
}

// --- uscita verso il resto della pagina (task 8.21, regola 5.1.6)
{
  const fermo6: EdgeState = {
    target: 6, last: 6, moving: false, dir: 1,
    haSotto: true, sbloccato: false, scrollY: 0,
  };
  assert.equal(edgeAction(fermo6), "sblocca", "allo step 6 un gesto giù deve sbloccare");
  assert.equal(edgeAction({ ...fermo6, haSotto: false }), "rimbalzo", "senza niente sotto si rimbalza");
  assert.equal(edgeAction({ ...fermo6, moving: true }), "step", "a corsa in atto non si esce");
  assert.equal(edgeAction({ ...fermo6, target: 5 }), "step");
  assert.equal(edgeAction({ ...fermo6, dir: -1 }), "step", "allo step 6 un gesto su torna al 5");
  assert.equal(edgeAction({ ...fermo6, dir: 0 }), "step");

  const fuori = { ...fermo6, sbloccato: true };
  assert.equal(edgeAction({ ...fuori, dir: -1 }), "riaggancia", "in cima un gesto su riaggancia");
  // rimbalzo elastico di Safari: `scrollY` negativo vale come cima
  assert.equal(edgeAction({ ...fuori, dir: -1, scrollY: -12 }), "riaggancia");
  assert.equal(edgeAction({ ...fuori, dir: 1 }), "nativo", "in cima un gesto giù scorre");
  for (const dir of [-1, 0, 1]) {
    assert.equal(edgeAction({ ...fuori, dir, scrollY: 300 }), "nativo", "sotto la cima è tutto nativo");
  }

  // riaggancio con la rotella: lo fa il primo evento verso l'alto, poi la
  // coda d'inerzia dello stesso gesto non deve far scattare 6 → 5
  const g = new WheelGesture();
  let t = 9000;
  g.feed(-30, 0, (t += 16), 900);
  g.consume();
  let step = 0;
  for (const d of [-40, -32, -24, -16, -9, -5, -2, -1]) step += g.feed(d, 0, (t += 16), 900);
  assert.equal(step, 0, "la coda dopo il riaggancio ha fatto uno step");
  // un gesto nuovo dopo la pausa invece sì
  step += g.feed(-40, 0, (t += 400), 900);
  assert.equal(step, -1, "dopo il riaggancio il gesto nuovo non torna al 5");
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

// --- moto ridotto: gradini e dissolvenza al posto della rotazione (task 8.24)
{
  const o = { p: -1, alpha: -1 };
  assert.deepEqual(reducedPose(1, 1, 2, o), { p: 1, alpha: 1 }, "alla partenza");
  assert.deepEqual(reducedPose(2, 1, 2, o), { p: 2, alpha: 1 }, "all'arrivo");
  assert.equal(reducedPose(1.5, 1, 2, o).alpha, 0, "a metà la scena è sparita");
  assert.equal(reducedPose(1.25, 1, 2, o).p, 1, "prima metà: lo step di partenza");
  assert.equal(reducedPose(1.75, 1, 2, o).p, 2, "seconda metà: lo step d'arrivo");
  assert.equal(reducedPose(2.6, 1, 4, o).p, 4, "un salto non mostra gli step di mezzo");
  assert.equal(reducedPose(3, 4, 4, o).p, 4, "da fermi vale lo step");
  assert.equal(reducedPose(-0.03, 0, 0, o).alpha, 1, "il rimbalzo non fa sparire niente");
  // inversione a metà corsa: da 1 → 2 a p 1,3 si torna a 1. La scena era
  // allo step 1 con alpha 0,4 e ci resta, senza salti
  assert.equal(reducedPose(1.3, 2, 1, o).p, 1);
  assert.ok(Math.abs(reducedPose(1.3, 2, 1, o).alpha - 0.4) < 1e-9);
  for (let p = 0; p <= 1; p += 0.05) {
    const { p: step } = reducedPose(p, 0, 1, o);
    assert.ok(Number.isInteger(step), `p intera anche a ${p}`);
  }
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
  for (const vp of [computeViewport(1440, 900, 2), computeViewport(2560, 1080, 1), computeViewport(390, 844, 3), computeViewport(768, 1024, 2)]) {
    const m = new StateMapper(vp);
    const kfs = keyframesFor(vp);
    for (let i = 0; i <= m.last; i++) {
      const s = m.apply(i);
      const kf = `${vp.width}×${vp.height} step ${i}`;
      // ricostruzione: punto ancorato = pivot + offset ruotato
      const off = new (await import("three")).Vector3(0, kfs[i].anchor.localY, 0).applyEuler(s.rotation);
      const mondo = s.pivot.clone().add(off);
      const cam = new (await import("three")).PerspectiveCamera(28, vp.aspect, 0.1, 100);
      cam.position.copy(s.camera.position);
      cam.lookAt(s.camera.look);
      cam.updateMatrixWorld(true);
      const ndc = mondo.clone().project(cam);
      const schermo = [(ndc.x + 1) / 2, (1 - ndc.y) / 2];
      const atteso = kfs[i].anchor.screen;
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

// --- la fascia accesa non entra mai nel testo (task 8.23)
//
// Il criterio della spec ("la bottiglia non copre mai i testi e la fascia
// accesa è sempre leggibile") in forma misurabile: agli step 2–5 la fascia,
// proiettata in camera, sta fuori dal rettangolo del blocco di testo. Desktop:
// il blocco è a `left: 10vw`, largo `min(520px, 42vw)` (StepText.module.css),
// e la fascia sta tutta alla sua destra. Layout mobile: il testo occupa dal
// 60% al 92% dell'altezza (spec 7.3), e la fascia sta tutta sopra il 60%.
// Il resto della bottiglia può passare dietro il testo su mobile: lì la
// leggibilità la danno la sfumatura e lo strato sopra il canvas.
{
  const THREE = await import("three");
  const { CAMERA } = await import("../src/config/solvePivot.ts");
  const { LABEL } = await import("../src/config/bottle.ts");
  /** il testo su mobile comincia qui (spec 7.3) */
  const TESTO_MOBILE_TOP = 0.6;
  for (const vp of [computeViewport(1440, 900, 2), computeViewport(390, 844, 3), computeViewport(768, 1024, 2)]) {
    const layoutMobile = vp.mobile || vp.portrait;
    const m = new StateMapper(vp);
    const cam = new THREE.PerspectiveCamera(CAMERA.fov, vp.aspect, 0.1, 100);
    const bordoTesto = (0.1 * vp.width + Math.min(520, 0.42 * vp.width)) / vp.width;
    for (let i = 2; i <= 5; i++) {
      const s = m.apply(i);
      cam.position.copy(s.camera.position);
      cam.lookAt(s.camera.look);
      cam.updateMatrixWorld(true);
      let minX = Infinity;
      let maxY = -Infinity;
      const { focusY, focusHalf } = s.uniforms;
      for (const y of [focusY - focusHalf, focusY, focusY + focusHalf]) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
          const locale = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
          const punto = locale
            .clone()
            .multiplyScalar(LABEL.radius)
            .setY(y - BOTTLE.centerY)
            .applyEuler(s.rotation)
            .add(s.pivot);
          // solo l'arco rivolto alla camera: il resto della fascia è dietro
          const normale = locale.applyEuler(s.rotation);
          if (normale.dot(cam.position.clone().sub(punto)) <= 0) continue;
          const ndc = punto.project(cam);
          minX = Math.min(minX, (ndc.x + 1) / 2);
          maxY = Math.max(maxY, (1 - ndc.y) / 2);
        }
      }
      const nome = `${vp.width}×${vp.height} step ${i}`;
      if (layoutMobile) {
        assert(maxY < TESTO_MOBILE_TOP, `${nome}: la fascia scende a ${maxY.toFixed(3)}, dentro il testo`);
      } else {
        assert(minX > bordoTesto, `${nome}: la fascia arriva a x ${minX.toFixed(3)}, dentro il testo (${bordoTesto.toFixed(3)})`);
      }
      if (i === 2 || i === 5) {
        console.log(
          `fascia ${nome}:`,
          layoutMobile ? `fondo ${maxY.toFixed(3)} < ${TESTO_MOBILE_TOP}` : `bordo sinistro ${minX.toFixed(3)} > ${bordoTesto.toFixed(3)}`,
        );
      }
    }
  }
}

// --- dove cadono protagonista e piedistallo nell'hero (task 8.19)
{
  const { heroLayout } = await import("../src/core/heroLayout.ts");
  for (const vp of [computeViewport(1440, 900, 2), computeViewport(2560, 1080, 1), computeViewport(390, 844, 3)]) {
    const l = heroLayout(vp);
    const ancora = keyframesFor(vp)[0].anchor.screen[1];
    const nome = `${vp.width}×${vp.height}`;
    console.log(`hero ${nome}:`, { centerY: +l.centerY.toFixed(3), pedestalTopY: +l.pedestalTopY.toFixed(3) });
    assert(Math.abs(l.centerY - ancora) < 1e-3, `${nome}: il pivot cade a ${l.centerY} invece che all'ancora ${ancora}`);
    assert(l.pedestalTopY > l.centerY && l.pedestalTopY < 1, `${nome}: piedistallo fuori posto (${l.pedestalTopY})`);
  }
}

// --- finale: tempi della scritta gigante e spazio delle CTA (task 8.20)
{
  const THREE = await import("three");
  const { FINALE } = await import("../src/config/text.ts");
  const { REST_LIFE } = await import("../src/config/keyframes.ts");
  const { EASE_NAME, LAST_STEP } = await import("../src/config/theme.ts");
  const ease = gsap.parseEase(EASE_NAME);
  const sm = new StateMapper(computeViewport(1440, 900, 2));
  const giro = Math.PI * 2;
  const durata = STEP_DURATION[LAST_STEP - 1];

  // all'andata la scritta entra quando la rotazione è quasi finita: si legge
  // lo stato vero a quel punto, non si ricalcolano le finestre a mano
  const pEntrata = LAST_STEP - 1 + ease(FINALE.enterAt);
  const mancante = (giro - sm.apply(pEntrata).rotation.y) / Math.PI;
  console.log(
    `finale: entrata a p=${pEntrata.toFixed(3)}, manca il ${(mancante * 100).toFixed(1)}% del mezzo giro`,
  );
  assert(mancante < 0.05, `la scritta entra con la bottiglia ancora in rotazione: ${mancante}`);

  // al ritorno la rotazione riparte quando `p` ha percorso la parte del
  // segmento che sta oltre la finestra: con la curva `uranio`, che parte
  // piano, quel tratto prende una frazione di tempo molto più grande
  const fine = SEGMENTS[LAST_STEP - 1].windows.rotazione![1];
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < 1 - fine) lo = mid;
    else hi = mid;
  }
  const ferma = lo * durata;
  console.log(
    `finale: al ritorno la bottiglia resta ferma ${ferma.toFixed(3)} s, la scritta esce in ${FINALE.exit.duration} s`,
  );
  assert(FINALE.exit.duration < ferma, "la scritta esce dopo che la bottiglia è ripartita");
  // e la proprietà vera, letta dallo stato: a uscita finita non ha ancora girato
  const pUscita = LAST_STEP - ease(FINALE.exit.duration / durata);
  assert(
    Math.abs(sm.apply(pUscita).rotation.y - giro) < 1e-9,
    "la bottiglia ruota prima che la scritta sia uscita",
  );

  // spazio: il fondo della bottiglia, riproiettato come le ancore, sta sopra
  // le CTA. Il fondo è un anello del raggio del corpo (per eccesso), e la
  // vita a riposo può abbassarlo di `REST_LIFE.y.amp`.
  for (const [vp, top] of [
    [computeViewport(1440, 900, 2), FINALE.ctaTop.desktop],
    [computeViewport(390, 844, 3), FINALE.ctaTop.mobile],
    // tablet verticale: layout mobile, quindi la CTA mobile (task 8.23)
    [computeViewport(768, 1024, 2), FINALE.ctaTop.mobile],
  ] as const) {
    const s = new StateMapper(vp).apply(LAST_STEP);
    const cam = new THREE.PerspectiveCamera(28, vp.aspect, 0.1, 100);
    cam.position.copy(s.camera.position);
    cam.lookAt(s.camera.look);
    cam.updateMatrixWorld(true);
    let fondo = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const punto = new THREE.Vector3(
        Math.cos(a) * BOTTLE.bodyRadius,
        BOTTLE.minY - BOTTLE.centerY,
        Math.sin(a) * BOTTLE.bodyRadius,
      )
        .applyEuler(s.rotation)
        .add(s.pivot);
      punto.y -= REST_LIFE.y.amp;
      fondo = Math.max(fondo, (1 - punto.project(cam).y) / 2);
    }
    console.log(
      `finale ${vp.width}×${vp.height}: fondo bottiglia a ${fondo.toFixed(3)}, CTA da ${top}`,
    );
    assert(top - fondo > 0.02, `CTA sotto la bottiglia senza margine a ${vp.width}×${vp.height}`);
  }
}

// --- shader della bottiglia: i marcatori di three e la patch (task 8.10)
{
  const THREE = await import("three");
  const { MARKERS, createBottleUniforms, patchBottleMaterial } = await import(
    "../src/gl/materials/patchBottle.ts"
  );

  // Le API di three cambiano spesso (regola 10.1.5) e questi tre `#include`
  // sono l'unico appiglio della patch: se un aggiornamento li rinomina, la
  // bottiglia resterebbe illuminata per intero senza un errore.
  for (const nome of ["physical", "standard"] as const) {
    const lib = THREE.ShaderLib[nome];
    assert(
      lib.vertexShader.includes(MARKERS.common) &&
        lib.vertexShader.includes(MARKERS.beginVertex),
      `shader ${nome}: i marcatori del vertex shader non ci sono più (three ${THREE.REVISION})`,
    );
    assert(
      lib.fragmentShader.includes(MARKERS.common) &&
        lib.fragmentShader.includes(MARKERS.dithering),
      `shader ${nome}: i marcatori del fragment shader non ci sono più (three ${THREE.REVISION})`,
    );
  }

  // la patch si applica davvero e porta dentro i suoi uniform
  for (const etichetta of [false, true]) {
    const mat = etichetta
      ? new THREE.MeshStandardMaterial()
      : new THREE.MeshPhysicalMaterial();
    const u = createBottleUniforms();
    patchBottleMaterial(mat, u, etichetta);
    const lib = THREE.ShaderLib[etichetta ? "standard" : "physical"];
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: lib.vertexShader,
      fragmentShader: lib.fragmentShader,
    };
    mat.onBeforeCompile(shader as never, null as never);
    assert(shader.vertexShader.includes("vObjPos = position;"), "vertex non patchato");
    assert(shader.fragmentShader.includes("uniform float uReveal"), "uniform non dichiarati");
    assert(shader.fragmentShader.includes("gl_FragColor.rgb *= reveal * focus * uDim;"), "maschere non applicate");
    assert(
      shader.fragmentShader.includes("uFocusGlow") === true,
      "il bagliore è dichiarato in entrambi: è la riga che lo usa a cambiare",
    );
    assert.equal(
      shader.fragmentShader.includes("gl_FragColor.rgb += uFocusGlow"),
      etichetta,
      "il bagliore rosso deve stare solo sull'etichetta",
    );
    // `pow(base, 2.0)` con base negativa è indefinito in GLSL: la lama di luce
    // va scritta come prodotto
    assert(
      !shader.fragmentShader.includes("pow((normal.x"),
      "la lama di luce usa pow() con base negativa",
    );
    assert.equal(shader.uniforms.uReveal, u.uReveal, "gli uniform non sono condivisi");
    assert.equal(
      mat.customProgramCacheKey(),
      etichetta ? "bottle-label" : "bottle-surface",
      "senza chiave di cache three riuserebbe il programma sbagliato",
    );
    mat.dispose();
  }

  // e se un marcatore sparisse, si fallisce a voce alta
  {
    const mat = new THREE.MeshPhysicalMaterial();
    patchBottleMaterial(mat, createBottleUniforms());
    assert.throws(
      () =>
        mat.onBeforeCompile(
          { uniforms: {}, vertexShader: "void main(){}", fragmentShader: "void main(){}" } as never,
          null as never,
        ),
      /non c.è più nello shader/,
      "una patch che non trova il suo marcatore deve fallire, non passare in silenzio",
    );
    mat.dispose();
  }
}

// --- carosello: anello, inclinazioni con seme, aggancio (task 8.13)
{
  const { CarouselState, slotAngle, slotPose } = await import(
    "../src/core/Carousel.ts"
  );
  const { CAROUSEL } = await import("../src/config/beers.ts");
  const N = CAROUSEL.count;

  // lo slot davanti è al centro e a z = 0: l'anello è tangente alla camera,
  // non centrato sull'origine
  const davanti = slotPose(0, 0, 0, N);
  assert(Math.abs(davanti.x) < 1e-12 && Math.abs(davanti.z) < 1e-12, "lo slot 0 non è davanti");
  // e la sua posa è quella del keyframe dell'hero, non una pescata dal seme
  assert.equal(+davanti.rotX.toFixed(6), KEYFRAMES[0].rotation[0]);
  assert.equal(+davanti.rotZ.toFixed(6), KEYFRAMES[0].rotation[2]);
  assert.equal(davanti.rotY, 0, "la protagonista deve mostrare il fronte");

  // le laterali arretrano tutte (z negativo) e si distribuiscono a sinistra e
  // a destra
  let aSinistra = 0;
  let aDestra = 0;
  for (let slot = 1; slot < N; slot++) {
    const p = slotPose(slot, 0, 0, N);
    assert(p.z < 0, `lo slot ${slot} non è arretrato`);
    if (p.x < 0) aSinistra++;
    else aDestra++;
    // inclinazioni dentro le fasce dichiarate
    assert(
      p.rotX >= CAROUSEL.tilt.xMin - 1e-9 && p.rotX <= CAROUSEL.tilt.xMax + 1e-9,
      `inclinazione x fuori fascia allo slot ${slot}: ${p.rotX}`,
    );
    assert(Math.abs(p.rotZ) <= CAROUSEL.tilt.zMax + 1e-9, `inclinazione z fuori fascia allo slot ${slot}`);
    assert(Math.abs(p.y) <= CAROUSEL.tilt.yOffsetMax + 1e-9, `scarto y fuori fascia allo slot ${slot}`);
  }
  assert(aSinistra > 0 && aDestra > 0, "le laterali stanno tutte dalla stessa parte");

  // il seme è fisso: due chiamate identiche danno lo stesso risultato, e due
  // slot diversi no (altrimenti sarebbero tutte inclinate uguale)
  assert.deepEqual(slotPose(3, 0, 0, N), slotPose(3, 0, 0, N), "il seme non è deterministico");
  assert.notDeepEqual(
    { x: slotPose(3, 0, 0, N).rotZ, y: slotPose(3, 0, 0, N).rotX },
    { x: slotPose(4, 0, 0, N).rotZ, y: slotPose(4, 0, 0, N).rotX },
    "due slot hanno la stessa inclinazione",
  );

  // girare l'anello di un passo equivale a cambiare slot attivo di uno
  const passo = (Math.PI * 2) / N;
  assert(
    Math.abs(slotAngle(1, 0, -passo, N) - slotAngle(1, 1, 0, N)) < 1e-12,
    "rot e active non sono equivalenti: la rinormalizzazione dell'aggancio sposterebbe la scena",
  );

  // --- stato: trascinamento, inerzia, aggancio
  {
    gsap.ticker.lagSmoothing(0);
    const avanza = (dt: number) =>
      gsap.globalTimeline.time(gsap.globalTimeline.time() + dt);
    const c = new CarouselState(N);

    // un trascinamento corto e lento: si torna allo slot di prima
    c.grab(0);
    for (let i = 1; i <= 5; i++) c.drag(2, i * 16);
    assert(c.rot > 0 && c.dragging, "il trascinamento non muove l'anello");
    c.release();
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, 0, "un trascinamento corto ha cambiato slot");
    assert.equal(c.rot, 0);

    // un colpetto corto ma veloce porta avanti di uno (inerzia, spec 6.6)
    c.grab(500);
    c.drag(12, 516);
    assert(c.velocity > CAROUSEL.flickVelocity, `velocità troppo bassa per uno scatto: ${c.velocity}`);
    c.release();
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, -1, "lo scatto non ha portato avanti di uno slot");
    c.active = 0;

    // un trascinamento lungo e lento: cambia slot, e la posa resta identica
    // dopo la rinormalizzazione (è il punto di tutto l'impianto)
    c.grab(1000);
    const px = passo / CAROUSEL.dragPerPixel;
    for (let i = 1; i <= 60; i++) c.drag(-px / 60, 1000 + i * 32);
    const primaDellAggancio = [0, 1, 2].map((s) => slotPose(s, c.active, c.rot, N));
    c.release();
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, 1, `l'aggancio non ha cambiato slot: active ${c.active}`);
    assert.equal(c.rot, 0, "rot non è stato rinormalizzato");
    const dopo = [0, 1, 2].map((s) => slotPose(s, c.active, c.rot, N));
    for (let i = 0; i < dopo.length; i++) {
      assert(
        Math.abs(dopo[i].x - primaDellAggancio[i].x) < 0.02 &&
          Math.abs(dopo[i].z - primaDellAggancio[i].z) < 0.02,
        "la rinormalizzazione ha spostato la scena: si vedrebbe uno scatto al rilascio",
      );
    }

    // le frecce: ±1 slot, senza trascinamento
    c.nudge(1);
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, 2, "la freccia avanti non ha portato lo slot successivo davanti");
    c.nudge(-1);
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, 1, "la freccia indietro non torna");

    // due click rapidi sulla stessa freccia valgono due passi, non uno: il
    // secondo arriva a scatto in corso, prima della rinormalizzazione
    c.nudge(1);
    avanza(0.1);
    c.nudge(1);
    avanza(CAROUSEL.snapDuration + 0.01);
    assert.equal(c.active, 3, `due frecce rapide hanno fatto ${c.active - 1} passi invece di 2`);
    assert.equal(c.rot, 0);

    // il pallino dello slider: continuo durante lo scatto, fermo dopo
    assert(Math.abs(c.ring - 3 / N) < 1e-12, `slider a ${c.ring} invece di ${3 / N}`);
    c.nudge(1);
    let ultimo = c.ring;
    for (let i = 0; i < 20; i++) {
      avanza(CAROUSEL.snapDuration / 20);
      assert(c.ring >= ultimo - 1e-9 && c.ring - ultimo < 1 / N, "lo slider salta durante lo scatto");
      ultimo = c.ring;
    }
    avanza(0.01);
    assert(Math.abs(c.ring - 4 / N) < 1e-9, `slider a ${c.ring} dopo lo scatto invece di ${4 / N}`);
    c.active = 1;

    // eventi nello stesso millisecondo: la velocità non deve diventare Infinity
    c.grab(2000);
    c.drag(5, 2000);
    c.drag(5, 2000);
    assert(Number.isFinite(c.velocity), `velocità non finita: ${c.velocity}`);
    c.release();
    avanza(CAROUSEL.snapDuration + 0.01);
    assert(Number.isFinite(c.rot), "rot non finito dopo un aggancio");

    // un rilascio senza trascinamento non fa niente
    const prima = c.active;
    c.release();
    assert.equal(c.active, prima);
    c.dispose();
  }
}

// --- uno swipe orizzontale è del carosello, non del motore a step
{
  assert.equal(swipeDirection(-80, 300, 10), 1, "swipe verticale ignorato");
  assert.equal(swipeDirection(-50, 300, 120), 0, "un trascinamento orizzontale ha fatto uno step");
  assert.equal(swipeDirection(-80, 300, 80), 1, "a parità di assi vince il verticale");
}

console.log("verify-core: OK");

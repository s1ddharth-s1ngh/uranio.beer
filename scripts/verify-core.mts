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
    haSotto: true, haSopra: true, sbloccato: false, scrollY: 0,
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

  // allo step 0, sopra c'è il hero: un gesto su torna indietro col passaggio
  const fermo0 = { ...fermo6, target: 0, dir: -1 };
  assert.equal(edgeAction(fermo0), "esci", "allo step 0 un gesto su torna al hero");
  assert.equal(edgeAction({ ...fermo0, haSopra: false }), "step", "senza hero sopra rimbalza Progress");
  assert.equal(edgeAction({ ...fermo0, moving: true }), "step", "a corsa in atto non si esce");
  assert.equal(edgeAction({ ...fermo0, dir: 1 }), "step", "allo step 0 un gesto giù va all'1");
  assert.equal(edgeAction({ ...fermo0, target: 1 }), "step");

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

// --- la home: hero, passaggio, esperienza, pagina (lib/pageScroll.ts)
{
  const { passageEase, syncAction } = await import("../src/lib/pageScroll.ts");
  assert.equal(passageEase(0), 0);
  assert.equal(passageEase(1), 1);
  assert.equal(passageEase(0.5), 0.5, "curva simmetrica");
  for (let t = 0; t < 1; t += 0.05) {
    assert.ok(passageEase(t + 0.05) >= passageEase(t), "lo scroll del passaggio non torna indietro");
  }

  // cima dell'esperienza a 720 px (una schermata di 900 meno la
  // sovrapposizione del 20%)
  const top = 720;
  assert.equal(syncAction(0, top, "hero", true), "hero");
  assert.equal(syncAction(300, top, "hero", true), "scendi", "dal hero non ci si ferma a metà");
  assert.equal(syncAction(top, top, "hero", true), "esperienza", "ripristinata in cima all'esperienza");
  assert.equal(syncAction(top, top, "hero", false), "pagina", "senza motore niente blocco");
  assert.equal(syncAction(top + 0.5, top, "pagina", true), "pagina", "appena sbloccata non si riblocca");
  assert.equal(syncAction(top + 400, top, "esperienza", true), "pagina");
  assert.equal(syncAction(300, top, "pagina", true), "riaggancia", "risalendo oltre la cima si riaggancia");
  assert.equal(syncAction(300, top, "pagina", false), "sali", "senza motore si torna al hero");
  assert.equal(syncAction(0.5, top, "pagina", true), "hero", "Home dalla pagina porta al hero");
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
  // del mezzo giro (fronte → retro, segmento 1)
  {
    const meta = sm.apply(1.45).uniforms;
    assert(meta.sweepAmt > SEGMENTS[1].sweepAmt * 0.9, `la lama non si accende: ${meta.sweepAmt}`);
    assert(meta.sweep > SHADER.sweepFrom && meta.sweep < SHADER.sweepTo);
    // nei segmenti fra le fasce è volutamente più timida
    assert(sm.apply(2.5).uniforms.sweepAmt <= SEGMENTS[2].sweepAmt + 1e-9);
  }

  // le finestre sfalsano davvero: le altre scappano dall'anello appena parte
  // la corsa verso il fronte, e alla fine entrano in fila solo quando la
  // protagonista ha già fatto spazio
  {
    assert.equal(sm.apply(0).carousel.escape, 0, "l'anello non è in scena allo step 0");
    assert.equal(sm.apply(0).carousel.layout, 0, "allo step 0 le altre non sono sull'anello");
    assert.equal(sm.apply(0).props, 0, "faro e piedistallo non sono in scena allo step 0");
    assert.equal(sm.apply(0.5).carousel.escape, 1, "l'anello è ancora in scena a metà corsa verso il fronte");
    assert.equal(sm.apply(5.25).carousel.escape, 1, "la gamma entra prima che la camera faccia spazio");
    assert.equal(sm.apply(6).carousel.escape, 0, "la gamma non è in fila all'ultimo step");
    assert.equal(sm.apply(6).carousel.layout, 1, "all'ultimo step le altre non sono in fila");
    // fra anello e fila nessun clone da disegnare: è il retro, quasi tutta
    // l'esperienza. E l'anello diventa fila solo mentre sono fuori scena
    for (const i of [1, 2, 3, 4, 5]) assert.equal(sm.apply(i).carousel.escape, 1, `altre bottiglie in scena allo step ${i}`);
    for (let p = 0; p <= sm.last; p += 0.02) {
      const c = sm.apply(p).carousel;
      if (c.layout > 0 && c.layout < 1) assert.equal(c.escape, 1, `l'anello si fa fila in vista a p=${p.toFixed(2)}`);
    }
    for (const i of [1, 2, 3, 4, 5, 6]) assert.equal(sm.apply(i).props, 1, `faro e piedistallo in scena allo step ${i}`);
  }

  // il tappo: chiuso sull'anello e sul fronte, staccato su tutto il retro,
  // di nuovo chiuso quando arriva la gamma. Salta all'inizio del mezzo giro,
  // quando la bottiglia è ancora quasi di fronte
  {
    assert.equal(sm.apply(0).cap, 0);
    assert.equal(sm.apply(1).cap, 0, "il tappo è già aperto sul fronte");
    for (const i of [2, 3, 4, 5]) assert.equal(sm.apply(i).cap, 1, `il tappo non è staccato allo step ${i}`);
    assert.equal(sm.apply(6).cap, 0, "il tappo non si richiude con la gamma");
    const salto = SEGMENTS[1].windows.tappo!;
    const rot = SEGMENTS[1].windows.rotazione!;
    assert(salto[0] <= rot[0] + 0.05, "il tappo salta a giro già avviato");
    // e si richiude mentre le altre arrivano, non prima che partano
    const chiude = SEGMENTS[5].windows.tappo!;
    assert(chiude[1] > SEGMENTS[5].windows.lati![0], "il tappo si richiude prima che arrivino le altre");
  }

  // la luce sulla faccia: piena sul fronte, spenta su tutto il retro (lì
  // comanda la fascia accesa)
  {
    assert.equal(sm.apply(1).face, 1);
    for (const i of [2, 3, 4, 5]) assert.equal(sm.apply(i).face, 0, `luce sulla faccia accesa allo step ${i}`);
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

  // le fasce dell'etichetta coincidono con le ancore degli step 2–5, e ogni
  // fascia accende l'arco del suo blocco di testo, non uno uguale per tutte
  for (const [i, b] of [BANDS.f1, BANDS.f2, BANDS.f3, BANDS.f4].entries()) {
    const s = sm.apply(i + 2);
    assert.equal(+s.uniforms.focusY.toFixed(6), +b.y.toFixed(6));
    assert.equal(+s.uniforms.focusAngleHalf.toFixed(6), +b.angleHalf.toFixed(6));
    assert(b.angleHalf > 0.2 && b.angleHalf < 1, `arco della fascia ${i + 1} fuori misura: ${b.angleHalf}`);
    assert.equal(
      +KEYFRAMES[i + 2].anchor.localY.toFixed(6),
      +(b.y - BOTTLE.centerY).toFixed(6),
      `l'ancora dello step ${i + 2} non è la sua fascia`,
    );
  }
  assert(BANDS.f4.angleHalf < BANDS.f1.angleHalf, "la fascia della raccolta è larga quanto gli ingredienti");
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

// --- anello e fronte: le due composizioni dell'apertura (riferimento
// ciaoenergy.com). Allo step 0 la protagonista sta tutta in quadro, al
// centro. Allo step 1, su desktop, è il primo piano della faccia come la
// lattina del riferimento: l'etichetta grande (almeno un terzo
// dell'altezza), tutta in quadro e a destra del nome (`left: 10vw`, largo
// `min(460px, 36vw)`, HeroUi.module.css); il collo esce dal bordo alto. Nei
// formati verticali la bottiglia intera: il tappo in quadro sotto l'header
// (allo step dopo salta) e l'etichetta sopra il nome, che sta in basso
{
  const THREE = await import("three");
  const { CAMERA } = await import("../src/config/solvePivot.ts");
  const { LABEL } = await import("../src/config/bottle.ts");
  for (const vp of [computeViewport(1440, 900, 2), computeViewport(2560, 1080, 1), computeViewport(390, 844, 3), computeViewport(768, 1024, 2)]) {
    const verticale = vp.mobile || vp.portrait;
    const nome = `${vp.width}×${vp.height}`;
    const box = (step: number, y0: number, y1: number, r: number) => {
      const s = new StateMapper(vp).apply(step);
      const cam = new THREE.PerspectiveCamera(CAMERA.fov, vp.aspect, 0.1, 100);
      cam.position.copy(s.camera.position);
      cam.lookAt(s.camera.look);
      cam.updateMatrixWorld(true);
      const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      for (let y = y0; y <= y1 + 1e-9; y += (y1 - y0) / 8) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          const ndc = new THREE.Vector3(Math.sin(a) * r, y - BOTTLE.centerY, Math.cos(a) * r)
            .applyEuler(s.rotation)
            .add(s.pivot)
            .project(cam);
          b.x0 = Math.min(b.x0, (ndc.x + 1) / 2);
          b.x1 = Math.max(b.x1, (ndc.x + 1) / 2);
          b.y0 = Math.min(b.y0, (1 - ndc.y) / 2);
          b.y1 = Math.max(b.y1, (1 - ndc.y) / 2);
        }
      }
      return b;
    };
    // la faccia (il fronte dell'etichetta, +z nel modello) guarda in alto a
    // destra, verso la luce: allo step 1 decisamente, allo step 0 un poco
    for (const step of [0, 1]) {
      const faccia = new THREE.Vector3(0, 0, 1).applyEuler(new StateMapper(vp).apply(step).rotation);
      assert(faccia.x > 0.15 && faccia.y > 0.1, `${nome}: allo step ${step} la faccia non guarda in alto a destra (${faccia.toArray().map((n) => n.toFixed(2))})`);
    }
    const anello = box(0, BOTTLE.minY, BOTTLE.maxY, BOTTLE.bodyRadius);
    assert(anello.y0 > 0.03 && anello.y1 < 0.97, `${nome}: allo step 0 la protagonista esce dal quadro`);
    assert(Math.abs((anello.x0 + anello.x1) / 2 - 0.5) < 0.05, `${nome}: allo step 0 la protagonista non è al centro`);

    const tappo = box(1, 4.05, BOTTLE.maxY, 0.35);
    const etichetta = box(1, LABEL.minY, LABEL.maxY, LABEL.radius);
    console.log(`fronte ${nome}: tappo da y ${tappo.y0.toFixed(3)}, etichetta x0 ${etichetta.x0.toFixed(3)} y ${etichetta.y0.toFixed(3)}–${etichetta.y1.toFixed(3)}`);
    if (verticale) {
      assert(tappo.y0 > 0.06, `${nome}: allo step 1 il tappo è sotto l'header o fuori quadro (y ${tappo.y0.toFixed(3)})`);
      assert(tappo.x0 > 0.02 && tappo.x1 < 0.98, `${nome}: allo step 1 il tappo esce dai lati`);
      assert((etichetta.y0 + etichetta.y1) / 2 < 0.6, `${nome}: allo step 1 l'etichetta scende nel nome`);
    } else {
      const bordoNome = (0.1 * vp.width + Math.min(460, 0.36 * vp.width)) / vp.width;
      assert(etichetta.x0 > bordoNome, `${nome}: l'etichetta arriva a ${etichetta.x0.toFixed(3)}, sotto il nome (${bordoNome.toFixed(3)})`);
      assert(etichetta.y0 > 0.1 && etichetta.y1 < 0.99 && etichetta.x1 < 0.97, `${nome}: allo step 1 l'etichetta esce dal quadro`);
      assert(etichetta.y1 - etichetta.y0 > 0.33, `${nome}: allo step 1 la faccia non è un primo piano (${(etichetta.y1 - etichetta.y0).toFixed(3)} dell'altezza)`);
    }
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
    assert.equal(
      shader.fragmentShader.includes("uFace * uFaceColor * diffuseColor.rgb"),
      etichetta,
      "la luce sulla faccia deve stare solo sull'etichetta",
    );
    // l'alone attorno alla fascia invece è di tutte le superfici
    assert(shader.fragmentShader.includes("halo * uFocusGlow * uFocusHalo"), "manca l'alone della fascia");
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

// --- l'anello (step 0) e la fila (ultimo step): le stesse copie in due pose
// (riferimento ciaoenergy.com). Si proiettano i centri. La fila: la
// protagonista al centro, sale verso destra, tutte in vista tranne le due
// estreme che escono a metà dai bordi, anche su telefono dove sono cinque.
// L'anello: le vicine ai lati della protagonista e non sopra di lei, chi gira
// verso il fondo più spenta
{
  const { ringPose, rowPose, slotOffset, slotPose } = await import("../src/core/Carousel.ts");
  const { GAMMA, RING, ringFor } = await import("../src/config/beers.ts");
  const { configureCamera } = await import("../src/config/solvePivot.ts");
  const { LAST_STEP } = await import("../src/config/theme.ts");
  const THREE = await import("three");

  // gli scarti sono una permutazione centrata: 0, +1, −1, +2, −2…
  const scarti = Array.from({ length: GAMMA.count }, (_, s) => slotOffset(s));
  assert.deepEqual([...scarti].sort((a, b) => a - b), [-4, -3, -2, -1, 0, 1, 2, 3, 4], `scarti della fila: ${scarti}`);

  const posa = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
  const proietta = (vp: ReturnType<typeof computeViewport>, step: number, N: number, pose: (slot: number) => void) => {
    const s = new StateMapper(vp).apply(step);
    const cam = configureCamera(
      new THREE.PerspectiveCamera(),
      { position: s.camera.position.toArray(), look: s.camera.look.toArray() },
      vp.aspect,
    );
    return Array.from({ length: N }, (_, slot) => {
      pose(slot);
      const ndc = new THREE.Vector3(posa.x, posa.y, posa.z).add(s.pivot).project(cam);
      return { i: slotOffset(slot), x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2, dim: posa.dim };
    }).sort((a, b) => a.i - b.i);
  };

  for (const [vp, N] of [
    [computeViewport(1440, 900, 2), GAMMA.count],
    [computeViewport(2560, 1080, 1), GAMMA.count],
    [computeViewport(390, 844, 3), GAMMA.countMobile],
    [computeViewport(768, 1024, 2), GAMMA.count],
  ] as const) {
    const nome = `${vp.width}×${vp.height}`;
    const fila = proietta(vp, LAST_STEP, N, (slot) => rowPose(slot, posa));
    console.log(`fila ${nome}:`, fila.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("  "));
    for (let k = 1; k < fila.length; k++) {
      assert(fila[k].x > fila[k - 1].x, `${nome}: la fila non va da sinistra a destra`);
    }
    assert(fila.at(-1)!.y < fila[0].y, `${nome}: la fila non sale verso destra`);
    for (const p of fila.slice(1, -1)) {
      assert(p.x > 0.02 && p.x < 0.98 && p.y > 0.05 && p.y < 0.95, `${nome}: lo slot ${p.i} è fuori quadro (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }

    // l'anello, solo gli slot che si disegnano
    const ring = ringFor(vp);
    const anello = proietta(vp, 0, N, (slot) => ringPose(slot, ring, posa)).filter((p) => Math.abs(p.i) <= RING.maxOffset);
    console.log(`anello ${nome}:`, anello.map((p) => p.x.toFixed(2)).join("  "));
    for (let k = 1; k < anello.length; k++) {
      assert(anello[k].x > anello[k - 1].x, `${nome}: l'anello non va da sinistra a destra`);
    }
    const centro = anello.find((p) => p.i === 0)!;
    // la larghezza della protagonista a schermo, in frazione della larghezza:
    // il corpo è largo 2 raggi, e la camera dell'anello ne vede `2·z·tan(fov/2)`
    // in altezza
    const s0 = new StateMapper(vp).apply(0);
    const alto = 2 * s0.camera.position.z * Math.tan((28 * Math.PI) / 360);
    const larga = ((2 * BOTTLE.bodyRadius) / alto) / vp.aspect;
    for (const p of anello) {
      if (p.i === 0) continue;
      // la vicina non copre la protagonista: fra i centri più di una
      // bottiglia, cioè non si toccano (su telefono il frame non concede di
      // più: le vicine finirebbero fuori dai bordi)
      assert(Math.abs(p.x - centro.x) > 1.15 * larga, `${nome}: lo slot ${p.i} dell'anello sta sopra la protagonista`);
      assert(p.dim < 1 && p.dim > 0, `${nome}: lo slot ${p.i} dell'anello non si spegne verso il fondo`);
    }
    const vicine = anello.filter((p) => Math.abs(p.i) === 1);
    for (const p of vicine) assert(p.x > 0.05 && p.x < 0.95, `${nome}: una vicina dell'anello è fuori quadro`);
    // e sale verso destra, come quello del riferimento
    assert(vicine[1].y < vicine[0].y, `${nome}: l'anello non sale verso destra`);
  }

  // la posa mescolata vale l'anello a 0 e la fila a 1
  const a = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, dim: 1 };
  const b = { ...a };
  const uguali = (cosa: string) => {
    for (const k of Object.keys(a) as (keyof typeof a)[]) {
      assert(Math.abs(a[k] - b[k]) < 1e-9, `${cosa}: ${k} ${a[k]} invece di ${b[k]}`);
    }
  };
  for (const slot of [1, 2, 5]) {
    slotPose(slot, 0, RING.desktop, a);
    ringPose(slot, RING.desktop, b);
    uguali("a layout 0 la posa non è l'anello");
    slotPose(slot, 1, RING.desktop, a);
    rowPose(slot, b);
    uguali("a layout 1 la posa non è la fila");
  }
}

// --- il tappo che salta (la richiesta del 2026-11-04): la forma del volo
// come funzione di `cap`, e il punto in cui resta sospeso dentro il frame,
// fuori dal blocco di testo e dalle icone, a ogni formato
{
  const { capFlash, capPose } = await import("../src/core/Cap.ts");
  const { CAP_MOTION } = await import("../src/config/cap.ts");
  const posa = { pop: 0, fly: 0, spin: 0, tumble: 0 };
  assert.deepEqual(capPose(0, posa), { pop: 0, fly: 0, spin: 0, tumble: 0 }, "da chiuso il tappo non è sul collo");
  capPose(1, posa);
  assert.equal(posa.fly, 1);
  assert(Math.abs(posa.tumble) < 1e-9, "da sospeso il tappo è ancora capovolto");
  assert(Math.abs(posa.pop - CAP_MOTION.pop) < 1e-9);
  let prima = -1;
  let picco = 0;
  for (let o = 0; o <= 1.0001; o += 0.01) {
    const { fly, pop } = capPose(o, posa);
    assert(fly >= prima - 1e-9, `il volo torna indietro a ${o.toFixed(2)}`);
    prima = fly;
    picco = Math.max(picco, pop);
  }
  // salta oltre e ricade: è lo scatto del tappo
  assert(picco > CAP_MOTION.pop * 1.05, "il salto non ha lo scatto");
  assert.equal(capFlash(0), 0, "il lampo è acceso da chiuso");
  assert.equal(capFlash(1), 0, "il lampo è acceso da sospeso");
  assert(capFlash(CAP_MOTION.flash.at) > 0.99);

  for (const [vp, h] of [
    [computeViewport(1440, 900, 2), CAP_MOTION.hover.desktop],
    [computeViewport(2560, 1080, 1), CAP_MOTION.hover.desktop],
    [computeViewport(390, 844, 3), CAP_MOTION.hover.portrait],
    [computeViewport(768, 1024, 2), CAP_MOTION.hover.portrait],
  ] as const) {
    const [x, y] = h.screen;
    assert(x > 0.5 && x < 0.9 && y > 0.08 && y < 0.4, `${vp.width}×${vp.height}: il tappo sospeso è fuori posto`);
    if (!(vp.mobile || vp.portrait)) {
      // a destra del testo e a sinistra delle icone (a ~92 px dal bordo)
      const bordoTesto = (0.1 * vp.width + Math.min(520, 0.42 * vp.width)) / vp.width;
      assert(x > bordoTesto + 0.1 && x < 1 - 110 / vp.width, `${vp.width}×${vp.height}: il tappo sospeso tocca testo o icone`);
    }
  }
}

// --- il cursore: a destra la faccia gira a destra, in alto si alza
{
  const THREE = await import("three");
  const { lookQuaternion, Pointer } = await import("../src/core/Pointer.ts");
  const q = new THREE.Quaternion();
  const faccia = (x: number, y: number, amp = 1) =>
    new THREE.Vector3(0, 0, 1).applyQuaternion(lookQuaternion({ x, y }, amp, q));
  assert(faccia(1, 0).x > 0.2, "col mouse a destra la faccia non gira a destra");
  assert(faccia(-1, 0).x < -0.2, "col mouse a sinistra la faccia non gira a sinistra");
  assert(faccia(0, -1).y > 0.1, "col mouse in alto la faccia non si alza");
  assert(faccia(-1, -1).x < 0 && faccia(-1, -1).y > 0, "in alto a sinistra non guarda in alto a sinistra");
  assert.equal(faccia(0, 0).z, 1, "al centro la faccia non guarda dritta");
  assert(faccia(1, 0, 0.5).x < faccia(1, 0).x, "l'ampiezza non scala");

  // lo smorzamento insegue senza superare, e non dipende dal frame rate
  const a = new Pointer();
  const b = new Pointer();
  a.set(1440, 0, 1440, 900);
  b.set(1440, 0, 1440, 900);
  assert.equal(a.tx, 1);
  assert.equal(a.ty, -1);
  for (let i = 0; i < 60; i++) a.update(1 / 60);
  for (let i = 0; i < 120; i++) b.update(1 / 120);
  assert(Math.abs(a.x - b.x) < 1e-9, "a 120 Hz insegue a un'altra velocità");
  assert(a.x > 0.8 && a.x < 1, `dopo un secondo il cursore smorzato è a ${a.x}`);
  a.set(-100, 2000, 1440, 900);
  assert.equal(a.tx, -1, "fuori dalla finestra non si satura");
  assert.equal(a.ty, 1);
}

// --- l'ingresso: la bottiglia arriva al suo posto dello step 0, funzione di
// `intro` (task 8.22, rivisto)
{
  const { bottleDrop, bottleRise, bottleSpin, Intro, UI_AT } = await import("../src/core/Intro.ts");
  const { INTRO } = await import("../src/config/intro.ts");
  const { configureCamera } = await import("../src/config/solvePivot.ts");
  const THREE = await import("three");

  for (const vp of [computeViewport(1440, 900, 2), computeViewport(2560, 1080, 1), computeViewport(390, 844, 3), computeViewport(768, 1024, 2)]) {
    // a `intro` 0 spenta e sotto il frame: la cima, abbassata del `drop`, si
    // proietta sotto il bordo basso
    const s = new StateMapper(vp).apply(0);
    const cam = configureCamera(
      new THREE.PerspectiveCamera(),
      { position: s.camera.position.toArray(), look: s.camera.look.toArray() },
      vp.aspect,
    );
    const cima = new THREE.Vector3(0, BOTTLE.maxY - BOTTLE.centerY, 0)
      .applyEuler(s.rotation)
      .add(s.pivot)
      .setY(s.pivot.y + (BOTTLE.maxY - BOTTLE.centerY) + bottleDrop(0));
    const y = (1 - cima.project(cam).y) / 2;
    assert(y > 1, `${vp.width}×${vp.height}: a intro 0 la cima è in vista (y ${y.toFixed(3)})`);
  }
  assert.equal(bottleRise(0), 0);
  assert.equal(bottleRise(1), 1);
  // le altre dell'anello arrivano dopo di lei, a coppie verso l'esterno, e a
  // fine ingresso ci sono tutte
  const { slotRise } = await import("../src/core/Intro.ts");
  for (const k of [1, 2, 3, 4]) {
    assert.equal(slotRise(1, k), 1, `a fine ingresso lo scarto ${k} non è arrivato`);
    assert(slotRise(0.4, k) <= slotRise(0.4, k - 1), `lo scarto ${k} arriva prima del ${k - 1}`);
  }
  assert.equal(slotRise(0.5, 0), bottleRise(0.5), "lo slot 0 non arriva con la protagonista");
  assert.equal(bottleDrop(1) + 0, 0);
  assert.equal(bottleSpin(1), 0);
  for (let u = 0.05; u <= 1; u += 0.05) {
    assert(bottleRise(u) >= bottleRise(u - 0.05), `la salita torna indietro a ${u.toFixed(2)}`);
  }
  // il titolo entra quando la bottiglia è quasi ferma, non prima
  assert(UI_AT * INTRO.duration < INTRO.bottle.start + INTRO.bottle.rise, "il titolo entra a bottiglia ferma da un pezzo");
  assert(bottleRise(UI_AT) > 0.85, `il titolo entra con la bottiglia ancora lontana: ${bottleRise(UI_AT)}`);

  // `play` arriva a 1 e avvisa una volta sola, `skip` subito
  gsap.ticker.lagSmoothing(0);
  const avanza = (dt: number) => gsap.globalTimeline.time(gsap.globalTimeline.time() + dt);
  const intro = new Intro();
  let avvisi = 0;
  intro.subscribe(() => avvisi++);
  assert(!intro.uiReady);
  intro.play();
  for (let i = 0; i < 50; i++) avanza(INTRO.duration / 40);
  assert.equal(intro.value, 1, `play si ferma a ${intro.value}`);
  assert(intro.uiReady);
  assert.equal(avvisi, 1, `uiReady ha avvisato ${avvisi} volte`);
  const saltata = new Intro();
  let avvisiSalto = 0;
  saltata.subscribe(() => avvisiSalto++);
  saltata.skip();
  assert.equal(saltata.value, 1);
  assert.equal(avvisiSalto, 1);
}

// --- uno swipe orizzontale non è uno step: il gesto deve essere verticale
{
  assert.equal(swipeDirection(-80, 300, 10), 1, "swipe verticale ignorato");
  assert.equal(swipeDirection(-50, 300, 120), 0, "un trascinamento orizzontale ha fatto uno step");
  assert.equal(swipeDirection(-80, 300, 80), 1, "a parità di assi vince il verticale");
}

console.log("verify-core: OK");

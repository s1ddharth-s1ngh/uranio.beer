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
import { keyframesFor, StateMapper, type SceneState } from "../src/core/StateMapper.ts";
import { KEYFRAMES, SEGMENTS, type Keyframe } from "../src/config/keyframes.ts";
import { BOTTLE, CAP } from "../src/config/bottle.ts";

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
  // si parte dal tetto, come la scena dopo ogni resize
  const TETTO = DPR_CAP.desktop;
  const sogliaMs = ADAPTIVE_DPR.slowFrame * 1000;

  // nessun campione durante il riscaldamento, per quanto lenti siano i frame
  assert.equal(gira(new AdaptiveDpr(), TETTO, 100, W - 0.2), TETTO, "il DPR scende mentre compilano gli shader");

  // sotto soglia non scende mai
  assert.equal(gira(new AdaptiveDpr(), TETTO, 16.7, W + 20), TETTO, "a 60 fps il DPR è sceso");
  assert.equal(gira(new AdaptiveDpr(), TETTO, sogliaMs - 0.5, W + 20), TETTO, "appena sotto soglia è sceso");

  // una finestra sopra soglia: un gradino, non di più
  const lenta = new AdaptiveDpr();
  gira(lenta, TETTO, sogliaMs + 5, W);
  assert.equal(gira(lenta, TETTO, sogliaMs + 5, ADAPTIVE_DPR.window - 0.1), TETTO, "è sceso prima della fine della finestra");
  assert.equal(
    gira(lenta, TETTO, sogliaMs + 5, 0.2),
    TETTO - ADAPTIVE_DPR.step,
    "una finestra sopra soglia non ha fatto scendere di un gradino",
  );

  // e mai sotto il minimo, per quanto a lungo resti lenta
  assert.equal(gira(new AdaptiveDpr(), TETTO, 40, W + 60), ADAPTIVE_DPR.min, "il DPR è andato sotto il minimo");

  // dopo un resize il riscaldamento riparte
  lenta.reset();
  assert.equal(gira(lenta, TETTO, 40, W - 0.2), TETTO, "il reset non riavvia il riscaldamento");
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

  // salto con l'indice degli step: parte anche a transizione in corso e passa dagli
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

  // i numeri dello stato con il loro nome nel keyframe: luci, tappo, cursore,
  // faro e piedistallo, le altre bottiglie
  const numeri = (s: SceneState) => ({ spot: s.spot, face: s.face, cap: s.cap, look: s.look, props: s.props, ...s.carousel });
  const numeriKf = (k: Keyframe): ReturnType<typeof numeri> => ({
    spot: k.spot, face: k.face, cap: k.cap, look: k.look, props: k.props,
    sideDim: k.sideDim, escape: k.escape, layout: k.layout,
  });

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
    const atteso = numeriKf(k);
    for (const [nome, v] of Object.entries(numeri(s))) {
      const kv = atteso[nome as keyof typeof atteso];
      assert(Math.abs(v - kv) < 1e-9, `${nome} allo step ${i}: ${v} invece di ${kv}`);
    }
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

  // nessun salto fra la fine di un segmento e l'inizio del successivo (lo
  // stato è riusato: prima di riapplicarlo si copia)
  for (let i = 1; i < sm.last; i++) {
    const a = sm.apply(i - 1e-4);
    const prima = { pivot: a.pivot.clone(), cam: a.camera.position.clone(), rot: a.rotation.toArray(), n: numeri(a) };
    const dopo = sm.apply(i + 1e-4);
    assert(prima.pivot.distanceTo(dopo.pivot) < 1e-2, `salto del pivot al confine ${i}: ${prima.pivot.distanceTo(dopo.pivot)}`);
    assert(prima.cam.distanceTo(dopo.camera.position) < 1e-2, `salto della camera al confine ${i}`);
    for (const [k, v] of [dopo.rotation.x, dopo.rotation.y, dopo.rotation.z].entries()) {
      assert(Math.abs((prima.rot[k] as number) - v) < 1e-2, `salto della rotazione al confine ${i}`);
    }
    for (const [nome, v] of Object.entries(numeri(dopo))) {
      const prec = prima.n[nome as keyof typeof prima.n];
      assert(Math.abs(prec - v) < 1e-2, `salto di ${nome} al confine ${i}: ${prec} → ${v}`);
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
  // di nuovo chiuso quando arriva la gamma. Salta prima che la bottiglia
  // cominci il mezzo giro, quando è ancora di fronte e intera in quadro
  {
    assert.equal(sm.apply(0).cap, 0);
    assert.equal(sm.apply(1).cap, 0, "il tappo è già aperto sul fronte");
    for (const i of [2, 3, 4, 5]) assert.equal(sm.apply(i).cap, 1, `il tappo non è staccato allo step ${i}`);
    assert.equal(sm.apply(6).cap, 0, "il tappo non si richiude con la gamma");
    const salto = SEGMENTS[1].windows.tappo!;
    const rot = SEGMENTS[1].windows.rotazione!;
    assert(salto[0] < rot[0], "il tappo salta a giro già avviato");
    // e si richiude mentre le altre arrivano, non prima che partano
    const chiude = SEGMENTS[5].windows.tappo!;
    assert(chiude[1] > SEGMENTS[5].windows.lati![0], "il tappo si richiude prima che arrivino le altre");
  }

  // la luce sulla faccia: piena sul fronte, dove la faccia guarda la luce
  assert.equal(sm.apply(1).face, 1);

  // il rimbalzo ai bordi deve **vedersi**: `p` sotto zero extrapola
  {
    const fermo = sm.apply(0).pivot.clone();
    const rimbalzo = sm.apply(-SCROLL.bounceAmount);
    assert(
      fermo.distanceTo(rimbalzo.pivot) > 1e-4,
      "il rimbalzo non muove nulla: lo stato è congelato sotto zero",
    );
  }

  // sul retro si raddrizza di step in step (spec 7.2)
  for (let i = 2; i < 5; i++) {
    assert(
      Math.abs(KEYFRAMES[i + 1].rotation[2]) < Math.abs(KEYFRAMES[i].rotation[2]),
      `la bottiglia non si raddrizza dallo step ${i} al ${i + 1}`,
    );
  }
}

// --- anello, fronte e retro: le composizioni (riferimento ciaoenergy.com).
// Allo step 0 la protagonista sta tutta in quadro, al centro. Dal fronte a
// tutto il retro la bottiglia è **intera** in quadro, dalla cima del tappo al
// fondo (la richiesta del 2026-11-17: "mi fa vedere l'intera bottiglia, non
// solo questa parte"). Su desktop, dal fronte a tutto il retro, la bottiglia
// sta tutta a destra della colonna dei testi (`left: 10vw`, larga
// `min(520px, 42vw)`, StepText.module.css); nei formati verticali allo step 1
// il tappo sta sotto l'header (allo step dopo salta) e l'etichetta sopra il
// testo, che sta in basso
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

    // la bottiglia intera: il tappo col suo raggio e il corpo col suo, alla
    // rotazione del keyframe. Il collo sta dentro i due
    const MARGINE = 0.02;
    const quadro: string[] = [];
    for (let step = 1; step <= 5; step++) {
      const ingombro = [box(step, CAP.minY, CAP.maxY, CAP.radius), box(step, BOTTLE.minY, LABEL.maxY, BOTTLE.bodyRadius)];
      const b = {
        x0: Math.min(...ingombro.map((q) => q.x0)), x1: Math.max(...ingombro.map((q) => q.x1)),
        y0: Math.min(...ingombro.map((q) => q.y0)), y1: Math.max(...ingombro.map((q) => q.y1)),
      };
      quadro.push(`${b.x0.toFixed(2)}–${b.x1.toFixed(2)} × ${b.y0.toFixed(2)}–${b.y1.toFixed(2)}`);
      assert(
        b.x0 > MARGINE && b.x1 < 1 - MARGINE && b.y0 > MARGINE && b.y1 < 1 - MARGINE,
        `${nome}: allo step ${step} la bottiglia esce dal quadro (${quadro.at(-1)})`,
      );
      if (!verticale) {
        const bordoTesto = (0.1 * vp.width + Math.min(520, 0.42 * vp.width)) / vp.width;
        assert(b.x0 > bordoTesto, `${nome}: allo step ${step} la bottiglia entra nei testi (${b.x0.toFixed(3)} < ${bordoTesto.toFixed(3)})`);
      }
    }
    console.log(`bottiglia ${nome}, step 1–5:`, quadro.join("  "));

    if (verticale) {
      const tappo = box(1, CAP.minY, CAP.maxY, CAP.radius);
      const etichetta = box(1, LABEL.minY, LABEL.maxY, LABEL.radius);
      assert(tappo.y0 > 0.06, `${nome}: allo step 1 il tappo è sotto l'header (y ${tappo.y0.toFixed(3)})`);
      assert((etichetta.y0 + etichetta.y1) / 2 < 0.6, `${nome}: allo step 1 l'etichetta scende nel testo`);
    }
  }
}

// --- finale: tempi della scritta gigante e spazio delle CTA (task 8.20)
{
  const THREE = await import("three");
  const { FINALE } = await import("../src/config/text.ts");
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
  // le CTA. Il fondo è un anello del raggio del corpo (per eccesso); a riposo
  // la bottiglia è ferma, quindi è lì che resta.
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

  // Le API di three cambiano spesso (regola 10.1.5) e questi due `#include`
  // sono l'unico appiglio della patch: se un aggiornamento li rinomina, le
  // laterali dell'anello resterebbero accese quanto la protagonista senza un
  // errore.
  for (const nome of ["physical", "standard"] as const) {
    const lib = THREE.ShaderLib[nome];
    assert(
      lib.fragmentShader.includes(MARKERS.common) &&
        lib.fragmentShader.includes(MARKERS.tonemapping),
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
    const fs = shader.fragmentShader;
    assert.equal(shader.vertexShader, lib.vertexShader, "la patch tocca il vertex shader");
    assert(fs.includes("uniform float uDim, uFace;"), "uniform non dichiarati");
    // la penombra si applica alla luce ancora lineare: prima del tone mapping
    // (che resta) e della conversione in sRGB
    const dim = fs.indexOf("gl_FragColor.rgb *= uDim;");
    assert(dim > 0, "penombra non applicata");
    assert(
      dim < fs.indexOf(MARKERS.tonemapping) && dim < fs.indexOf("#include <colorspace_fragment>"),
      "la penombra lavora dopo il tone mapping o in sRGB",
    );
    assert.equal(
      fs.includes("uFace * uFaceColor * diffuseColor.rgb"),
      etichetta,
      "la luce sulla faccia deve stare solo sull'etichetta",
    );
    assert.equal(shader.uniforms.uDim, u.uDim, "gli uniform non sono condivisi");
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
// L'anello: cinque bottiglie vicine, la protagonista davanti e le altre via
// via più indietro, chi gira verso il fondo più spenta
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
      // a schermo (x, y) e in scena, relativa alla protagonista (wx, wz)
      return { i: slotOffset(slot), x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2, dim: posa.dim, wx: posa.x, wz: posa.z };
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

    // l'anello, solo gli slot che si disegnano (lo stesso filtro di
    // `gl/Carousel.tsx`): un gruppo stretto di cinque, la protagonista e due
    // per parte (richiesta del 2026-11-17)
    const ring = ringFor(vp);
    const anello = proietta(vp, 0, N, (slot) => ringPose(slot, ring, posa)).filter((p) => Math.abs(p.i) <= RING.maxOffset);
    console.log(`anello ${nome}:`, anello.map((p) => p.x.toFixed(2)).join("  "));
    assert.equal(anello.length, 5, `${nome}: l'anello mostra ${anello.length} bottiglie invece di cinque`);
    for (let k = 1; k < anello.length; k++) {
      assert(anello[k].x > anello[k - 1].x, `${nome}: l'anello non va da sinistra a destra`);
    }
    for (const p of anello) {
      if (p.i === 0) continue;
      // A schermo si sovrappongono, ed è voluto: un gruppo stretto. Ma chi
      // sta più in fuori sta anche più indietro, quindi passa dietro alla
      // vicina interna e la protagonista resta davanti a tutte
      const interna = anello.find((q) => q.i === p.i - Math.sign(p.i))!;
      assert(p.wz < interna.wz, `${nome}: lo slot ${p.i} dell'anello non sta dietro il ${interna.i}`);
      assert(p.dim < 1 && p.dim > 0, `${nome}: lo slot ${p.i} dell'anello non si spegne verso il fondo`);
    }
    // vicine fra loro, non "alla distanza di 200 km": fra due centri contigui
    // meno di due corpi
    for (let k = 1; k < anello.length; k++) {
      const corpi = (anello[k].wx - anello[k - 1].wx) / (2 * BOTTLE.bodyRadius);
      assert(corpi < 2, `${nome}: fra lo slot ${anello[k - 1].i} e il ${anello[k].i} ci sono ${corpi.toFixed(2)} corpi`);
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
// fuori dal blocco di testo e dall'indice degli step, a ogni formato
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
      // a destra del testo e a sinistra dell'indice degli step (cliccabile fino a ~112 px dal bordo)
      const bordoTesto = (0.1 * vp.width + Math.min(520, 0.42 * vp.width)) / vp.width;
      assert(x > bordoTesto + 0.1 && x < 1 - 110 / vp.width, `${vp.width}×${vp.height}: il tappo sospeso tocca testo o indice`);
    }
  }
}

// --- il cursore: gira la bottiglia che gli sta vicino (richiesta del
// 2026-11-17: "non deve muovere tutte le bottiglie"). Con il cursore a destra
// di una bottiglia la sua faccia gira a destra, sopra si alza
{
  const THREE = await import("three");
  const { Pointer } = await import("../src/core/Pointer.ts");
  const q = new THREE.Quaternion();
  const dritta = new THREE.Quaternion();
  // il cursore al centro di 1440×900, già raggiunto dallo smorzamento
  const cursore = new Pointer();
  cursore.set(720, 450, 1440, 900);
  cursore.update(10);
  // la bottiglia in (sx, sy), nelle coordinate del cursore (y verso il basso)
  const faccia = (sx: number, sy: number, amp = 1) =>
    new THREE.Vector3(0, 0, 1).applyQuaternion(cursore.look(sx, sy, amp, q));
  const angolo = (sx: number, sy: number) => dritta.angleTo(cursore.look(sx, sy, 1, q));

  assert(faccia(-0.2, 0).x > 0.1, "col cursore a destra la faccia non gira a destra");
  assert(faccia(0.2, 0).x < -0.1, "col cursore a sinistra la faccia non gira a sinistra");
  assert(faccia(0, 0.2).y > 0.05, "col cursore sopra la faccia non si alza");
  assert(faccia(0, -0.2).y < -0.05, "col cursore sotto la faccia non si abbassa");
  assert(faccia(0.2, 0.2).x < 0 && faccia(0.2, 0.2).y > 0, "col cursore in alto a sinistra non guarda in alto a sinistra");
  assert.equal(faccia(0, 0).z, 1, "col cursore sulla bottiglia la faccia non guarda dritta");
  assert(faccia(-0.2, 0, 0.5).x < faccia(-0.2, 0).x, "l'ampiezza non scala");
  // locale: la bottiglia sul bordo, lontana dal cursore, quasi non si muove
  console.log(`cursore: vicino ${angolo(-0.2, 0).toFixed(3)} rad, sul bordo ${angolo(-1, 0).toFixed(4)} rad`);
  assert(angolo(-1, 0) < 0.1 * angolo(-0.2, 0), "una bottiglia lontana dal cursore gira quasi quanto una vicina");

  // senza mouse (`active` a 0) nessuna rotazione, dovunque sia il cursore
  assert.equal(new Pointer().look(-0.2, 0.2, 1, q).angleTo(dritta), 0, "senza mouse la bottiglia gira");
  cursore.reset();
  assert.equal(angolo(-0.2, 0), 0, "dopo reset() la bottiglia gira ancora");
  assert.equal(cursore.hero.angleTo(dritta), 0, "reset() non raddrizza la protagonista");
  // e quando il mouse esce dalla finestra l'influenza si spegne piano, non di colpo
  const via = new Pointer();
  via.set(720, 450, 1440, 900);
  via.update(10);
  const piena = via.look(-0.2, 0, 1, q).angleTo(dritta);
  via.release();
  via.update(1 / 60);
  const dopo = via.look(-0.2, 0, 1, q).angleTo(dritta);
  assert(dopo > 0.9 * piena && dopo < piena, "all'uscita del mouse la bottiglia scatta");

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

// Benchmark GPU dell'esperienza (seconda sezione della home): quanto costa un
// frame durante il passaggio dal hero e su ogni step, sulla GPU vera.
//
//   npx vite build --outDir <dir>     (una build: il dev server aggiunge StrictMode e HMR)
//   node scripts/bench-experience.mjs --dist <dir> [--port 4411]
//        [--sizes 1440x900,1920x1080] [--dpr 1] [--out <cartella screenshot>]
//
// Su stdout la tabella markdown, su stderr i progressi. Gira su Windows con
// ANGLE D3D11: senza GPU vera (swiftshader) i numeri non vogliono dire niente.
//
// Perché non si contano i fps: nella headless shell di Playwright rAF scatta
// ogni 16,7 ms anche con la GPU indietro di secondi. Si svuota invece la coda
// della GPU (`readPixels` di un pixel su ogni contesto WebGL della pagina), si
// contano i rAF per 1,5 s, si svuota di nuovo: tempo trascorso / frame.
// La shell aggiunge a ogni frame un costo fisso di composizione (~17 ms a
// 1440×900 su questa iGPU) che tiene la GPU sempre satura, quindi la misura è
// additiva: costo della pagina = misurato − pavimento. Il pavimento cresce coi
// pixel e si misura a ogni formato, su due canvas WebGL vuoti, all'inizio e
// alla fine.
// La new headless (`channel: "chromium"`) frena rAF come un browser vero e
// sotto i 16,7 ms legge tutto 60 fps; `--disable-frame-rate-limit` fa girare
// rAF oltre i 240 fps del ticker GSAP, e i frame contati non sono più quelli
// disegnati. Svuotare dopo ogni frame sopra i 16,7 ms dà numeri 4-5 volte più
// alti del vero (forse la GPU, ferma tra un frame e l'altro, abbassa il clock).

import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const { values: arg } = parseArgs({
  options: {
    dist: { type: "string" },
    port: { type: "string", default: "4411" },
    sizes: { type: "string", default: "1440x900,1920x1080" },
    dpr: { type: "string", default: "1" },
    out: { type: "string" },
  },
});
const formati = arg.sizes.split(",").map((s) => s.split("x").map(Number));
const dpr = Number(arg.dpr);
if (
  !arg.dist ||
  !existsSync(join(arg.dist, "index.html")) ||
  !(dpr > 0) ||
  formati.some((f) => f.length !== 2 || !f.every((n) => Number.isInteger(n) && n > 0))
) {
  console.error(
    "uso: node scripts/bench-experience.mjs --dist <build> [--port 4411] [--sizes 1440x900,1920x1080] [--dpr 1] [--out <dir>]",
  );
  process.exit(1);
}
if (arg.out) mkdirSync(arg.out, { recursive: true });

/**
 * Gira nella pagina prima del suo codice: si annota ogni contesto WebGL
 * creato, così si svuotano tutti (hero, sfondo, scena, quanti che siano) e un
 * canvas che non c'è più non rompe niente.
 */
function sonda() {
  const contesti = [];
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
    const c = get.call(this, tipo, ...resto);
    if (c && String(tipo).startsWith("webgl") && !contesti.includes(c)) contesti.push(c);
    return c;
  };
  const vivi = () => contesti.filter((g) => g.canvas.isConnected && !g.isContextLost());
  const px = new Uint8Array(4);
  // readPixels aspetta che la GPU finisca tutto quello che ha in coda. Il
  // framebuffer di lettura torna com'era: three.js lo tiene in cache
  const svuota = () => {
    for (const g of vivi()) {
      const fb = g.READ_FRAMEBUFFER ?? g.FRAMEBUFFER;
      const prima = g.getParameter(g.READ_FRAMEBUFFER_BINDING ?? g.FRAMEBUFFER_BINDING);
      g.bindFramebuffer(fb, null);
      g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
      g.bindFramebuffer(fb, prima);
    }
  };
  // un contesto perso (GPU contesa, reset del driver) manda l'esperienza alla
  // versione statica: la misura non vale. In cattura arrivano solo i canvas
  // nel documento, non quello di prova di `hasWebGL2`
  let persi = 0;
  addEventListener("webglcontextlost", () => persi++, true);
  let frame = 0;
  let id = 0;
  let t0 = 0;
  const conta = () => {
    frame++;
    id = requestAnimationFrame(conta);
  };
  window.__bench = {
    start() {
      svuota();
      frame = 0;
      id = requestAnimationFrame(conta);
      t0 = performance.now();
    },
    stop() {
      cancelAnimationFrame(id);
      svuota();
      return { ms: (performance.now() - t0) / frame, frame, persi };
    },
    contesti: () =>
      vivi().map((g) => {
        const d = g.getExtension("WEBGL_debug_renderer_info");
        return {
          dove: g.canvas.id || g.canvas.closest("[id]")?.id || "?",
          px: `${g.drawingBufferWidth}x${g.drawingBufferHeight}`,
          gpu: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?",
        };
      }),
  };
}

// il pavimento: due canvas WebGL a tutto schermo che a ogni frame si puliscono
// e basta, sfondo e scena senza niente dentro
const PAVIMENTO = `<!doctype html><style>body{margin:0}canvas{position:fixed;inset:0;width:100%;height:100%}</style>
<canvas></canvas><canvas></canvas><script>
const gs = [...document.querySelectorAll("canvas")].map((c) => {
  c.width = innerWidth * devicePixelRatio;
  c.height = innerHeight * devicePixelRatio;
  return c.getContext("webgl2", { alpha: true, antialias: false });
});
(function f() { for (const g of gs) g.clear(g.COLOR_BUFFER_BIT); requestAnimationFrame(f); })();
</script>`;

const mediana = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];

async function ferma(page) {
  const r = await page.evaluate(() => window.__bench.stop());
  assert(r.frame > 0, "nessun frame contato");
  assert(r.persi === 0, "contesto WebGL perso: misura da rifare");
  return r.ms;
}

// 3 finestre da 1,5 s; se non vanno d'accordo entro il 5% se ne aggiungono,
// fino a 7. Un'altra sessione che usa la GPU può solo allungare una finestra,
// mai accorciarla: più finestre, più probabilità di averne una pulita
async function finestre(page) {
  const v = [];
  while (v.length < 3 || (v.length < 7 && Math.max(...v) - Math.min(...v) > 0.05 * mediana(v))) {
    await page.evaluate(() => window.__bench.start());
    await page.waitForTimeout(1500);
    v.push(await ferma(page));
  }
  return v;
}

// `#step-N` si legge solo al caricamento: un goto con un altro hash non
// ricarica, quindi si passa da about:blank
async function apri(page, url) {
  await page.goto("about:blank");
  await page.goto(url);
  await page.locator("#gl canvas").waitFor({ state: "attached", timeout: 60_000 });
  await page.getByRole("status", { name: "Caricamento" }).waitFor({ state: "detached", timeout: 60_000 });
}

const server = await preview({
  configFile: false,
  logLevel: "error",
  build: { outDir: resolve(arg.dist) },
  preview: { port: Number(arg.port), strictPort: true, host: "127.0.0.1" },
});
const base = `http://127.0.0.1:${arg.port}`;
// la shell esplicita: è lei a non frenare rAF, e su lei è tarato il metodo
const browser = await chromium.launch({
  channel: "chromium-headless-shell",
  args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
});

const risultati = [];
try {
  for (const [width, height] of formati) {
    const nome = `${width}x${height}@${dpr}`;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
    await context.addInitScript(sonda);
    await context.route("**/__pavimento", (r) => r.fulfill({ contentType: "text/html", body: PAVIMENTO }));
    const page = await context.newPage();
    page.on("pageerror", (e) => console.error(`[${nome}] pageerror: ${e.message}`));
    const r = { nome, pavimento: [], passaggio: [], step: [] };

    const pavimento = async () => {
      await page.goto(`${base}/__pavimento`);
      await page.waitForTimeout(1000);
      r.pavimento.push(...(await finestre(page)));
    };
    console.error(`[${nome}] pavimento`);
    await pavimento();

    // il passaggio: dal hero una freccia giù, lo scroll animato (~1,4 s) e
    // l'ingresso dell'esperienza, fino a 2 s dopo l'aggancio. Ogni volta da
    // una pagina nuova, perché è il primo passaggio quello che si sente
    for (let i = 0; i < 3; i++) {
      console.error(`[${nome}] passaggio ${i + 1}/3`);
      await apri(page, `${base}/`);
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__bench.start());
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () => {
          const e = document.getElementById("esperienza");
          return (
            document.documentElement.classList.contains("scroll-locked") &&
            e !== null &&
            Math.abs(e.getBoundingClientRect().top) < 2
          );
        },
        null,
        { polling: 100, timeout: 30_000 },
      );
      await page.waitForTimeout(2000);
      r.passaggio.push(await ferma(page));
    }

    // gli step in fila con la freccia, come chi visita: l'arrivo lo dice
    // l'hash, che `step:enter` riscrive; poi 1,5 s perché entrino i testi
    await apri(page, `${base}/#step-0`);
    await page.waitForTimeout(3000);
    r.contesti = await page.evaluate(() => window.__bench.contesti());
    assert(r.contesti.some((c) => c.dove === "gl"), "nessun contesto WebGL vivo in #gl (perso? versione statica?)");
    for (let n = 0; n <= 6; n++) {
      if (n > 0) {
        await page.keyboard.press("ArrowDown");
        await page.waitForFunction((n) => location.hash === `#step-${n}`, n, { polling: 100, timeout: 30_000 });
        await page.waitForTimeout(1500);
      }
      console.error(`[${nome}] step ${n}`);
      r.step.push(await finestre(page));
      if (arg.out) await page.screenshot({ path: join(arg.out, `${nome}-step-${n}.jpg`), type: "jpeg", quality: 80 });
    }

    console.error(`[${nome}] pavimento, di nuovo`);
    await pavimento();
    risultati.push(r);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

// La stima è il minimo delle finestre: il disturbo (altre sessioni sulla
// GPU, che su questa macchina girano di continuo) si somma soltanto. La
// mediana tra parentesi dice quanto disturbo c'era: lontana dal minimo, la
// riga va rifatta prima di fidarsi di una differenza
const cella = (v) => `${Math.min(...v).toFixed(1)} (${mediana(v).toFixed(1)})`;
const gpu = risultati[0].contesti.find((c) => c.dove === "gl").gpu;
if (/swiftshader|llvmpipe|basic render/i.test(gpu)) console.error(`ATTENZIONE: GPU software (${gpu})`);
console.log(`GPU: ${gpu}`);
for (const r of risultati)
  console.log(`contesti WebGL a step 0, ${r.nome}: ${r.contesti.map((c) => `${c.dove} ${c.px}`).join(", ")}`);
console.log("");
console.log(`| | ${risultati.map((r) => `${r.nome} ms/frame min (mediana) | − pavimento`).join(" | ")} |`);
console.log(`|---|${risultati.map(() => "---:|---:|").join("")}`);
const riga = (titolo, scegli) =>
  console.log(
    `| ${titolo} | ${risultati
      .map((r) => `${cella(scegli(r))} | ${(Math.min(...scegli(r)) - Math.min(...r.pavimento)).toFixed(1)}`)
      .join(" | ")} |`,
  );
console.log(`| pavimento (2 canvas vuoti) | ${risultati.map((r) => `${cella(r.pavimento)} | `).join(" | ")} |`);
riga("passaggio", (r) => r.passaggio);
for (let n = 0; n <= 6; n++) riga(`step ${n}`, (r) => r.step[n]);

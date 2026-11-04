import { test, expect, type Page } from "@playwright/test";

// Percorso hero → 0 → 6 → 0 → hero con la tastiera, una schermata per step
// all'andata e al ritorno (spec 8.28). Nessun gancio di test nel codice:
// l'arrivo di uno step si legge dall'hash, che `step:enter` riscrive con
// `replaceState`; l'arrivo nell'esperienza dal blocco dello scroll
// (`lib/pageScroll.ts`) e dalla sua sezione in cima allo schermo.

const FORMATI = [
  { nome: "1440x900", width: 1440, height: 900 },
  { nome: "390x844", width: 390, height: 844 },
  { nome: "768x1024", width: 768, height: 1024 },
];

const ULTIMO = 6;
// i testi entrano al 45% della transizione e durano 0,7 s più lo stagger
const ATTESA_TESTI = 1200;
// lama di luce del segmento 0 → 1 (il mezzo giro): finestra [0,15; 0,75] su
// 1,5 s, picco a metà finestra. Il tempo è a occhio, l'easing di `p` lo
// sposta un poco
const META_0_1 = 700;
// passaggio hero → esperienza: metà corsa, e l'ingresso (la bottiglia che
// arriva, poi il titolo) dopo l'arrivo
const META_PASSAGGIO = 700;
const ATTESA_INGRESSO = 2500;

const cartella = "qa/screens";
// JPEG e non PNG: la grana animata non si comprime, e in PNG le schermate
// facevano 45 MB nello storico; a qualità 80 sono un decimo
const JPEG = { type: "jpeg", quality: 80 } as const;

async function arrivato(page: Page, n: number) {
  await page.waitForFunction((n) => location.hash === `#step-${n}`, n, { timeout: 15_000 });
  await page.waitForTimeout(ATTESA_TESTI);
}

for (const f of FORMATI) {
  test(`percorso ${f.nome}`, async ({ page }) => {
    const errori: string[] = [];
    page.on("pageerror", (e) => errori.push(e.message));

    await page.setViewportSize({ width: f.width, height: f.height });
    await page.goto("/");
    // il Loader è l'overlay con role=status "Caricamento": sparisce dal DOM
    // quando ha finito di scorrere via
    await page.getByRole("status", { name: "Caricamento" }).waitFor({ state: "detached", timeout: 60_000 });
    await page.waitForTimeout(ATTESA_TESTI);
    await page.screenshot({ path: `${cartella}/${f.nome}-hero-andata.jpg`, ...JPEG });

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(META_PASSAGGIO);
    await page.screenshot({ path: `${cartella}/${f.nome}-passaggio.jpg`, ...JPEG });
    await page.waitForFunction(() => {
      const e = document.getElementById("esperienza");
      return (
        document.documentElement.classList.contains("scroll-locked") &&
        e !== null &&
        Math.abs(e.getBoundingClientRect().top) < 2
      );
    }, null, { timeout: 30_000 });
    await page.waitForTimeout(ATTESA_INGRESSO);
    await page.screenshot({ path: `${cartella}/${f.nome}-0-andata.jpg`, ...JPEG });

    for (let n = 1; n <= ULTIMO; n++) {
      await page.keyboard.press("ArrowDown");
      if (n === 1) {
        await page.waitForTimeout(META_0_1);
        await page.screenshot({ path: `${cartella}/${f.nome}-lama-0-1.jpg`, ...JPEG });
      }
      await arrivato(page, n);
      await page.screenshot({ path: `${cartella}/${f.nome}-${n}-andata.jpg`, ...JPEG });
      // la lama a riposo deve essere spenta: stessa inquadratura, a fermo
      if (n === 1) await page.screenshot({ path: `${cartella}/${f.nome}-lama-riposo.jpg`, ...JPEG });
    }

    for (let n = ULTIMO - 1; n >= 0; n--) {
      await page.keyboard.press("ArrowUp");
      await arrivato(page, n);
      await page.screenshot({ path: `${cartella}/${f.nome}-${n}-ritorno.jpg`, ...JPEG });
    }

    // dallo step 0 un gesto verso l'alto riporta al hero, intero come all'inizio
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => window.scrollY <= 1, null, { timeout: 30_000 });
    await page.waitForTimeout(ATTESA_TESTI);
    await page.screenshot({ path: `${cartella}/${f.nome}-hero-ritorno.jpg`, ...JPEG });

    expect(errori).toEqual([]);
  });
}

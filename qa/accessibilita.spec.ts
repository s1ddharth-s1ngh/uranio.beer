import { test, expect, chromium } from "@playwright/test";

// Due voci della checklist 9.2 che si possono guardare senza un dispositivo:
// il moto ridotto (gli step arrivano lo stesso, in dissolvenza) e il fallback
// senza WebGL (al posto della scena le immagini di `ui/Fallback.tsx`).

const cartella = "qa/screens";
// JPEG e non PNG: la grana animata non si comprime, e in PNG le schermate
// facevano 45 MB nello storico; a qualità 80 sono un decimo
const JPEG = { type: "jpeg", quality: 80 } as const;

test("moto ridotto: 0 → 2 → 0 a 1440×900", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  // `#step-0` entra direttamente nell'esperienza, senza il passaggio dal hero
  await page.goto("/#step-0");
  await page.getByRole("status", { name: "Caricamento" }).waitFor({ state: "detached", timeout: 60_000 });
  for (const [tasto, n] of [["ArrowDown", 1], ["ArrowDown", 2], ["ArrowUp", 1], ["ArrowUp", 0]] as const) {
    await page.keyboard.press(tasto);
    await page.waitForFunction((n) => location.hash === `#step-${n}`, n, { timeout: 15_000 });
    await page.waitForTimeout(800);
    if (n === 2) await page.screenshot({ path: `${cartella}/ridotto-1440x900-2.jpg`, ...JPEG });
  }
});

test("senza WebGL: fallback a 1440×900 e 390×844", async () => {
  const browser = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2"] });
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    // Gli errori di pagina non si controllano: "Error creating WebGL context"
    // lo lancia il canvas del hero (`#hero`), che un fallback non l'ha. Fuori
    // dal perimetro dell'esperienza, annotato in docs/AUDIT.md
    await page.goto(`http://localhost:4318/#step-1`);
    await page.getByRole("status", { name: "Caricamento" }).waitFor({ state: "detached", timeout: 60_000 });
    await page.waitForTimeout(1000);
    // nessun canvas della scena: c'è solo il fallback
    expect(await page.locator("#esperienza canvas").count()).toBe(0);
    // la finestra e non l'elemento: la sezione è alta tre schermate, e la
    // schermata di un elemento più alto della finestra in headless esce nera
    await page.screenshot({ path: `${cartella}/senza-webgl-${w}x${h}.jpg`, ...JPEG });
    await page.close();
  }
  await browser.close();
});

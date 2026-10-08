import { defineConfig } from "@playwright/test";

// porta fissa e diversa dalla 5173: il dev server di chi sta lavorando può
// restare acceso mentre gira il percorso
const PORT = 4318;

export default defineConfig({
  testDir: ".",
  outputDir: "./.risultati",
  // il percorso è lungo (7 step andata e ritorno su tre formati) e la scena
  // in swiftshader disegna a pochi fps
  timeout: 240_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    deviceScaleFactor: 1,
    launchOptions: {
      // da solo Chromium headless disegna WebGL con swiftshader, in software:
      // a 1440×900 la scena fa ~3 fps, e con frame oltre i 500 ms il
      // `lagSmoothing` di GSAP rallenta il tempo (una transizione dura 9 s
      // invece di 1,6). Su Windows ANGLE D3D11 usa la GPU vera (~35 fps);
      // altrove, senza GPU, resta swiftshader
      args:
        process.platform === "win32"
          ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"]
          : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    // build e non dev server: l'HMR ricarica la pagina a metà percorso appena
    // qualcuno salva un file. Cartella propria per non toccare `dist/`
    command: `npx vite build --outDir qa/.dist --emptyOutDir && npx vite preview --outDir qa/.dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    cwd: "..",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

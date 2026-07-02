import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // target reali per la minificazione CSS: senza, LightningCSS può fondere
    // le proprietà prefissate scartando quella standard (es. backdrop-filter)
    cssTarget: ['chrome107', 'edge107', 'firefox115', 'safari15'],
  },
})

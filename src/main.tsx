import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Font self-hosted (variabili): niente richieste a Google Fonts.
// Di Archivo serve la variante con l'asse della larghezza (wdth) oltre a
// quello del peso: il display dell'esperienza vive a 900 di peso e 118 di
// larghezza, e senza quell'asse resterebbe a 100. I sottoinsiemi li sceglie
// il browser da sé via unicode-range, quindi per l'italiano scarica solo il
// latino (~100 KB).
import '@fontsource-variable/inter'
import '@fontsource-variable/archivo/wdth-italic.css'
import './styles/tokens.css'
import './styles/text.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

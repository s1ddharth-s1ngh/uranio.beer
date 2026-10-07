import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ComingSoon from './ComingSoon';
import SlashExperiment from './pages/SlashExperiment';

// L'esperienza porta dentro three, drei e gsap: statica, finirebbe nel bundle
// iniziale di tutto il sito e sfonderebbe da sola il budget della sezione 9
// (350 KB gzip). Lazy, resta un chunk a sé che chiede solo chi la apre.
const Experience = lazy(() => import('./pages/Experience'));

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/it" element={<Home />} />
        <Route path="/en" element={<Home />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/slash-experiment" element={<SlashExperiment />} />
        {/* lo scroll 3D in costruzione: va in home al task 8.21. Il fondo è
            già nero da `index.html`, quindi il fallback può essere vuoto:
            niente lampo bianco mentre arriva il chunk */}
        <Route
          path="/esperienza"
          element={
            <Suspense fallback={null}>
              <Experience />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

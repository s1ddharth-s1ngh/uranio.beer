import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ComingSoon from './ComingSoon';

// Pagina a sé con il suo campo di gocce: statica finiva nel JavaScript
// iniziale della home, che col budget 9.1 non ha un KB da regalare (task 8.27)
const SlashExperiment = lazy(() => import('./pages/SlashExperiment'));

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/it" element={<Home />} />
        <Route path="/en" element={<Home />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route
          path="/slash-experiment"
          element={
            <Suspense fallback={null}>
              <SlashExperiment />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

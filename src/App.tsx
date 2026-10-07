import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ComingSoon from './ComingSoon';
import SlashExperiment from './pages/SlashExperiment';
import Experience from './pages/Experience';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/it" element={<Home />} />
        <Route path="/en" element={<Home />} />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="/slash-experiment" element={<SlashExperiment />} />
        {/* lo scroll 3D in costruzione: va in home al task 8.21 */}
        <Route path="/esperienza" element={<Experience />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

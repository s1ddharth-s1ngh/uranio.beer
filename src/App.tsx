import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ComingSoon from './ComingSoon';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="*" element={<Navigate to="/coming-soon" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
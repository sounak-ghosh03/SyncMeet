import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Phase1Test from '@/pages/Phase1Test';

/**
 * App router.
 * Phase 1: only the media-test page exists.
 * Phases 2-4 will add: Home, PreJoin, Room, Ended pages.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Phase 1 test route */}
        <Route path="/test" element={<Phase1Test />} />

        {/* Temporary redirect — Phase 2 will add a real Home page at "/" */}
        <Route path="*" element={<Navigate to="/test" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


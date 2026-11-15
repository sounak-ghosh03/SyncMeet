import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/Home';
import PreJoinPage from '@/pages/PreJoin';
import RoomPage from '@/pages/Room';
import WaitingRoomPage from '@/pages/WaitingRoom';
import EndedPage from '@/pages/Ended';
import Phase1Test from '@/pages/Phase1Test';

/**
 * App router.
 * Phase 1: /test (media smoke test)
 * Phase 2: / (Home), /join/:roomId (PreJoin), /room/:roomId (Room), /ended
 * Phase 4: /waiting/:roomId/:requestId (WaitingRoom)
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join/:roomId" element={<PreJoinPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/waiting/:roomId/:requestId" element={<WaitingRoomPage />} />
        <Route path="/ended" element={<EndedPage />} />

        {/* Phase 1 test route — kept for reference */}
        <Route path="/test" element={<Phase1Test />} />
      </Routes>
    </BrowserRouter>
  );
}


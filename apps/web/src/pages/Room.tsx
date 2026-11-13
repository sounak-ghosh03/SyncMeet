import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMeetingToken, endMeeting } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { LiveKitProvider } from '@/lib/media';
import type { ParticipantInfo } from '@/lib/media';
import { loadHostKey, saveDisplayName } from '@/lib/storage';
import Spinner from '@/components/Spinner';

type RoomState = 'connecting' | 'connected' | 'ended' | 'error';

/**
 * Phase 2 Room page — connects to LiveKit and renders a minimal participant list.
 * Full video grid, controls bar, and chat panel are added in Phase 3.
 */
export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomState>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const providerRef = useRef<LiveKitProvider | null>(null);
  const hostKey = loadHostKey(roomId);
  const isHost = !!hostKey;

  // ── Load join prefs saved by PreJoin page ──────────────────────────────

  const joinPrefs = (() => {
    try {
      const raw = sessionStorage.getItem(`sm:joinPrefs:${roomId}`);
      return raw ? (JSON.parse(raw) as {
        name: string;
        camOn: boolean;
        micOn: boolean;
        selectedVideoId: string;
        selectedAudioId: string;
      }) : null;
    } catch { return null; }
  })();

  const displayName = joinPrefs?.name ?? 'Guest';

  // ── Connect on mount ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    try {
      const { token } = await getMeetingToken({
        roomId,
        name: displayName,
        hostKey: hostKey ?? undefined,
      });

      const provider = new LiveKitProvider();
      providerRef.current = provider;

      provider.on('participants', (list) => setParticipants(list));
      provider.on('disconnected', () => setRoomState('ended'));
      provider.on('error', (err) => {
        setErrorMsg(err.message);
        setRoomState('error');
      });

      await provider.connect(roomId, token);

      // Apply initial mute state from PreJoin
      const initialMic = joinPrefs?.micOn ?? true;
      const initialCam = joinPrefs?.camOn ?? true;
      setMicOn(initialMic);
      setCamOn(initialCam);
      await provider.setMicEnabled(initialMic);
      await provider.setCameraEnabled(initialCam);

      setRoomState('connected');
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setRoomState('ended');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to connect.');
        setRoomState('error');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
      providerRef.current?.disconnect();
    };
  }, [connect]);

  // ── Controls ───────────────────────────────────────────────────────────

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await providerRef.current?.setMicEnabled(next);
  }

  async function toggleCam() {
    const next = !camOn;
    setCamOn(next);
    await providerRef.current?.setCameraEnabled(next);
  }

  async function handleLeave() {
    await providerRef.current?.disconnect();
    navigate('/');
  }

  async function handleEndMeeting() {
    if (!hostKey) return;
    try {
      await endMeeting({ roomId, hostKey });
    } catch { /* Meeting may already be ended */ }
    await providerRef.current?.disconnect();
    navigate('/ended');
  }

  // Save name so PreJoin pre-fills it next time
  useEffect(() => {
    if (displayName && displayName !== 'Guest') {
      saveDisplayName(displayName);
    }
  }, [displayName]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (roomState === 'connecting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <Spinner message="Joining meeting…" />
      </div>
    );
  }

  if (roomState === 'ended') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg)' }}
      >
        <p className="text-4xl">🏁</p>
        <h2 className="text-xl font-semibold">Meeting ended</h2>
        <a href="/" className="text-sm underline" style={{ color: 'var(--accent)' }}>
          Start a new meeting
        </a>
      </div>
    );
  }

  if (roomState === 'error') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg)' }}
      >
        <p className="text-4xl">⚠️</p>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
        <button
          onClick={() => navigate('/')}
          className="text-sm underline"
          style={{ color: 'var(--accent)' }}
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--surface-2)' }}
      >
        <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
          SyncMeet
        </span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          Room: {roomId}
        </span>
        {isHost && (
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Host
          </span>
        )}
      </header>

      {/* Participant list — Phase 3 replaces this with VideoGrid */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {participants.length} participant{participants.length !== 1 ? 's' : ''} in room
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {participants.map((p) => (
            <div
              key={p.identity}
              className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: p.isSpeaking ? '2px solid var(--speaker)' : '2px solid transparent',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: 'var(--surface-2)' }}
              >
                {p.name[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                {p.name}
                {p.isLocal && ' (you)'}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {!p.hasAudio && '🔇 '}
                {!p.hasVideo && '📷 off'}
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Controls bar */}
      <footer
        className="flex items-center justify-center gap-3 px-4 py-4"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--surface-2)' }}
      >
        <ControlButton
          label={micOn ? '🎙 Mute' : '🔇 Unmute'}
          active={micOn}
          onClick={toggleMic}
        />
        <ControlButton
          label={camOn ? '📷 Stop video' : '📷 Start video'}
          active={camOn}
          onClick={toggleCam}
        />

        {/* Leave */}
        <button
          onClick={handleLeave}
          className="px-5 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--danger)', color: '#fff' }}
        >
          Leave
        </button>

        {/* End meeting — host only */}
        {isHost && (
          <button
            onClick={handleEndMeeting}
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: 'transparent',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
            }}
          >
            End for all
          </button>
        )}
      </footer>
    </div>
  );
}

function ControlButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-medium"
      style={{
        background: active ? 'var(--surface-2)' : 'var(--danger)',
        color: 'var(--text)',
        border: '1px solid var(--surface-2)',
      }}
    >
      {label}
    </button>
  );
}


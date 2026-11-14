import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMeetingToken, endMeeting } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { LiveKitProvider } from '@/lib/media';
import type { ParticipantInfo } from '@/lib/media';
import { loadHostKey, saveDisplayName, loadLayout, saveLayout, type LayoutMode } from '@/lib/storage';
import { RoomProvider } from '@/context/RoomContext';
import VideoGrid from '@/components/VideoGrid';
import ControlsBar from '@/components/ControlsBar';
import ChatPanel from '@/components/ChatPanel';
import Spinner from '@/components/Spinner';

type RoomState = 'connecting' | 'connected' | 'ended' | 'error';

export default function RoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomState>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);

  // Media state
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Layout
  const [layout, setLayout] = useState<LayoutMode>(loadLayout);

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Screen share blocked (another participant is sharing)
  const [screenshareBlocked, setScreenshareBlocked] = useState(false);

  const providerRef = useRef<LiveKitProvider | null>(null);
  const hostKey = loadHostKey(roomId);
  const isHost = !!hostKey;

  // ── Load join prefs saved by PreJoin ──────────────────────────────────────

  const joinPrefs = (() => {
    try {
      const raw = sessionStorage.getItem(`sm:joinPrefs:${roomId}`);
      return raw
        ? (JSON.parse(raw) as {
            name: string;
            camOn: boolean;
            micOn: boolean;
            selectedVideoId: string;
            selectedAudioId: string;
          })
        : null;
    } catch {
      return null;
    }
  })();

  const displayName = joinPrefs?.name ?? 'Guest';

  // ── Derived state ─────────────────────────────────────────────────────────

  const localParticipant = participants.find((p) => p.isLocal);
  const isScreenSharing = localParticipant?.isScreenSharing ?? false;
  const localIdentity = localParticipant?.identity ?? null;

  // Check if any other participant is screen sharing
  useEffect(() => {
    const othersSharing = participants.some((p) => !p.isLocal && p.isScreenSharing);
    setScreenshareBlocked(othersSharing);
  }, [participants]);

  // ── Connect on mount ──────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    try {
      const { token, lkUrl } = await getMeetingToken({
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

      await provider.connect(roomId, token, lkUrl);

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

  // Save name so PreJoin pre-fills it next time
  useEffect(() => {
    if (displayName && displayName !== 'Guest') {
      saveDisplayName(displayName);
    }
  }, [displayName]);

  // ── Keyboard shortcuts (M = mic, V = video, S = screen, C = chat) ────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'm': handleToggleMic(); break;
        case 'v': handleToggleCam(); break;
        case 's': handleToggleScreenShare(); break;
        case 'c': setIsChatOpen((v) => !v); break;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn, camOn, isScreenSharing, screenshareBlocked]);

  // ── Control handlers ──────────────────────────────────────────────────────

  async function handleToggleMic() {
    const next = !micOn;
    setMicOn(next);
    await providerRef.current?.setMicEnabled(next);
  }

  async function handleToggleCam() {
    const next = !camOn;
    setCamOn(next);
    await providerRef.current?.setCameraEnabled(next);
  }

  async function handleToggleScreenShare() {
    // Block second share: another participant is already sharing (edge case 12.5)
    if (!isScreenSharing && screenshareBlocked) return;

    try {
      await providerRef.current?.setScreenShareEnabled(!isScreenSharing);
    } catch (err) {
      // User cancelled the browser's share picker — fail silently (edge case 12.5)
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('cancel') && !msg.includes('Permission')) {
        console.error('[screenshare]', err);
      }
    }
  }

  function handleToggleLayout() {
    const next: LayoutMode = layout === 'grid' ? 'speaker' : 'grid';
    setLayout(next);
    saveLayout(next);
  }

  async function handleLeave() {
    await providerRef.current?.disconnect();
    navigate('/');
  }

  async function handleEndMeeting() {
    if (!hostKey) return;
    try {
      await endMeeting({ roomId, hostKey });
    } catch {
      /* Meeting may already be ended */
    }
    await providerRef.current?.disconnect();
    navigate('/ended');
  }

  // ── Render: loading / error / ended ──────────────────────────────────────

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

  // ── Render: connected room ────────────────────────────────────────────────

  const provider = providerRef.current!;
  const lkRoom = provider.getRoom();
  // Determine host identity for host badge in tiles
  // Local participant is the host only if we have a hostKey
  const hostIdentity = isHost ? (localIdentity ?? null) : null;

  return (
    <RoomProvider value={lkRoom}>
      <div
        className="flex flex-col"
        style={{ height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--surface-2)' }}
        >
          <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
            SyncMeet
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
            {isHost && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Host
              </span>
            )}
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
            >
              {roomId}
            </span>
          </div>
        </header>

        {/* Screen share banner */}
        {isScreenSharing && (
          <div
            className="flex items-center justify-between px-4 py-2 text-sm shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <span>📺 You are sharing your screen</span>
            <button
              onClick={handleToggleScreenShare}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Stop sharing
            </button>
          </div>
        )}

        {/* Main content: video grid + chat panel side by side */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Video grid */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <VideoGrid
              participants={participants}
              layout={layout}
              hostIdentity={hostIdentity}
            />
          </div>

          {/* Chat panel */}
          <ChatPanel
            provider={provider}
            localName={displayName}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            onUnreadChange={setUnreadCount}
          />
        </div>

        {/* Controls bar */}
        <ControlsBar
          micOn={micOn}
          camOn={camOn}
          isScreenSharing={isScreenSharing}
          isChatOpen={isChatOpen}
          unreadCount={unreadCount}
          layout={layout}
          isHost={isHost}
          screenshareBlocked={screenshareBlocked}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleChat={() => setIsChatOpen((v) => !v)}
          onToggleLayout={handleToggleLayout}
          onLeave={handleLeave}
          onEndMeeting={handleEndMeeting}
        />
      </div>
    </RoomProvider>
  );
}

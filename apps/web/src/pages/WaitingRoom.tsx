import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import Spinner from '@/components/Spinner';
import { pollJoinRequest } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { savePendingToken, saveDisplayName } from '@/lib/storage';

type WaitState = 'waiting' | 'admitted' | 'denied' | 'expired' | 'error';

const POLL_INTERVAL_MS = 2500;

/**
 * WaitingRoom page — shown when a guest joins a waiting-room meeting.
 * Polls the backend every 2.5s until the host admits or denies the request.
 * When admitted, saves the token to sessionStorage and navigates to /room/:roomId.
 */
export default function WaitingRoomPage() {
  const { roomId = '', requestId = '' } = useParams<{
    roomId: string;
    requestId: string;
  }>();
  const navigate = useNavigate();

  // Name is stored in sessionStorage by PreJoin before redirecting here
  const name = (() => {
    try {
      const raw = sessionStorage.getItem(`sm:joinPrefs:${roomId}`);
      return raw ? (JSON.parse(raw) as { name: string }).name : 'Guest';
    } catch { return 'Guest'; }
  })();

  const [state, setState] = useState<WaitState>('waiting');
  const [errorMsg, setErrorMsg] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId || !requestId) {
      setState('error');
      setErrorMsg('Invalid waiting room link.');
      return;
    }

    async function poll() {
      try {
        const result = await pollJoinRequest({ roomId, requestId });

        if (result.status === 'admitted') {
          clearInterval(intervalRef.current!);
          // Save the pre-issued token so Room.tsx uses it directly
          savePendingToken(roomId, result.token, result.lkUrl);
          if (name && name !== 'Guest') saveDisplayName(name);
          setState('admitted');
          // Brief delay so user sees the "Admitted!" state before navigating
          setTimeout(() => navigate(`/room/${roomId}`), 800);
        } else if (result.status === 'denied') {
          clearInterval(intervalRef.current!);
          setState('denied');
        } else if (result.status === 'expired') {
          clearInterval(intervalRef.current!);
          setState('expired');
        }
        // 'pending' — keep polling
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          clearInterval(intervalRef.current!);
          setState('error');
          setErrorMsg('Waiting room request not found.');
        }
        // Network errors — keep retrying silently
      }
    }

    poll(); // immediate first check
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [roomId, requestId, name, navigate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state === 'waiting') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-6 text-center max-w-xs">
          <div className="text-5xl">🚪</div>
          <div>
            <h2 className="text-xl font-semibold">Waiting to be let in</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              The host will admit you shortly.
            </p>
          </div>
          <div
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ background: 'var(--surface)', color: 'var(--muted)' }}
          >
            Joining as <span style={{ color: 'var(--text)' }}>{name}</span>
          </div>
          <Spinner />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            You can close this tab and the host will still see your request for a few minutes.
          </p>
        </div>
      </PageShell>
    );
  }

  if (state === 'admitted') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--speaker)' }}>
            You've been admitted!
          </h2>
          <Spinner message="Joining meeting…" />
        </div>
      </PageShell>
    );
  }

  if (state === 'denied') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="text-5xl">🚫</div>
          <h2 className="text-xl font-semibold">Not admitted</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The host did not admit you to this meeting.
          </p>
          <a
            href="/"
            className="text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            Go home
          </a>
        </div>
      </PageShell>
    );
  }

  if (state === 'expired') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="text-5xl">⏰</div>
          <h2 className="text-xl font-semibold">Request expired</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Your waiting room request timed out. Try joining again.
          </p>
          <a
            href={`/join/${roomId}`}
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Try again
          </a>
        </div>
      </PageShell>
    );
  }

  // error
  return (
    <PageShell>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-5xl">⚠️</div>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
        <a href="/" className="text-sm underline" style={{ color: 'var(--accent)' }}>
          Go home
        </a>
      </div>
    </PageShell>
  );
}

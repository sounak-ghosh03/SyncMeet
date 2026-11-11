import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
} from 'livekit-client';
import { getTestToken } from '@/lib/api';

/**
 * Phase 1 test page — not production UI.
 * Verifies that two browser tabs can see and hear each other.
 * Will be replaced by the real Room page in Phase 3.
 */

const ROOM_ID = 'phase1-test-room';

export default function Phase1TestPage() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  async function connect() {
    if (!name.trim()) return;
    setStatus('connecting');
    setError(null);

    try {
      const { token } = await getTestToken({ roomId: ROOM_ID, name: name.trim() });

      const lkUrl = import.meta.env.VITE_LK_URL as string;
      if (!lkUrl) throw new Error('VITE_LK_URL env var is not set');

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // Attach local camera
      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video && localVideoRef.current) {
          pub.track.attach(localVideoRef.current);
        }
      });

      // Attach remote tracks
      function attachRemote(participant: RemoteParticipant | LocalParticipant) {
        participant.getTrackPublications().forEach((pub) => {
          if (pub.track && pub.kind === Track.Kind.Video && remoteContainerRef.current) {
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.style.width = '300px';
            video.style.borderRadius = '8px';
            video.style.background = '#000';
            const label = document.createElement('p');
            label.textContent = participant.name ?? participant.identity;
            label.style.color = 'var(--text)';
            const wrapper = document.createElement('div');
            wrapper.setAttribute('data-identity', participant.identity);
            wrapper.appendChild(video);
            wrapper.appendChild(label);
            remoteContainerRef.current.appendChild(wrapper);
            pub.track.attach(video);
          }
        });
      }

      room.on(RoomEvent.TrackSubscribed, (_track, _pub, participant) => {
        attachRemote(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        const el = remoteContainerRef.current?.querySelector(
          `[data-identity="${participant.identity}"]`,
        );
        el?.remove();
      });

      await room.connect(lkUrl, token);
      await room.localParticipant.enableCameraAndMicrophone();
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
      cleanup();
    }
  }

  async function disconnect() {
    cleanup();
    setStatus('idle');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
        SyncMeet — Phase 1 Media Test
      </h1>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Open this page in two browser tabs. Both should see and hear each other.
      </p>

      {status === 'idle' && (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
            maxLength={60}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--surface-2)',
              outline: 'none',
            }}
          />
          <button
            onClick={connect}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Connect
          </button>
        </div>
      )}

      {status === 'connecting' && (
        <p style={{ color: 'var(--muted)' }}>Connecting…</p>
      )}

      {status === 'error' && (
        <div className="text-center">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-3 px-4 py-2 text-sm rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            Try again
          </button>
        </div>
      )}

      {status === 'connected' && (
        <>
          <p className="text-sm font-medium" style={{ color: 'var(--speaker)' }}>
            ● Connected to room: {ROOM_ID}
          </p>
          <div className="flex flex-wrap gap-6 justify-center">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>You (local)</p>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '300px',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  transform: 'scaleX(-1)',
                }}
              />
            </div>
            <div ref={remoteContainerRef} className="flex flex-wrap gap-4" />
          </div>
          <button
            onClick={disconnect}
            className="mt-4 px-5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            Disconnect
          </button>
        </>
      )}
    </div>
  );
}


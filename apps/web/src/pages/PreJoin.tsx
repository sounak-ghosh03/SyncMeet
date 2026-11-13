import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import Spinner from '@/components/Spinner';
import { getMeetingInfo, getMeetingToken, type MeetingInfo } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { loadDisplayName, saveDisplayName, loadHostKey } from '@/lib/storage';

type PageState = 'loading' | 'ready' | 'not_found' | 'ended' | 'joining' | 'error';

export default function PreJoinPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>('loading');
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [name, setName] = useState(loadDisplayName);
  const [passcode, setPasscode] = useState('');
  const [nameError, setNameError] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Camera/mic preview (off by default — user clicks to enable)
  const [previewActive, setPreviewActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Fetch meeting info ──────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) { setState('not_found'); return; }

    getMeetingInfo(roomId)
      .then((info) => {
        setMeetingInfo(info);
        setState('ready');
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          if (err.status === 404) setState('not_found');
          else if (err.status === 410) setState('ended');
          else setState('error');
        } else {
          setState('error');
        }
      });
  }, [roomId]);

  // ── Enumerate devices after permission ─────────────────────────────────

  async function enumerateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
    setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
  }

  // ── Start/stop preview stream ──────────────────────────────────────────

  async function startPreview() {
    stopPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true,
      });
      streamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
      stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      setPermissionDenied(false);
      await enumerateDevices();
    } catch {
      setPermissionDenied(true);
      setPreviewActive(false);
    }
  }

  function stopPreview() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
  }

  useEffect(() => {
    if (previewActive) {
      startPreview();
    } else {
      stopPreview();
    }
    return stopPreview;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewActive, selectedVideoId, selectedAudioId]);

  // Keep track mutes in sync without restarting stream
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), []);

  // ── Join ───────────────────────────────────────────────────────────────

  async function handleJoin() {
    const trimmedName = name.trim();
    let valid = true;

    if (!trimmedName) {
      setNameError('Please enter your name.');
      valid = false;
    } else if (trimmedName.length > 60) {
      setNameError('Name must be 60 characters or fewer.');
      valid = false;
    } else {
      setNameError('');
    }

    if (meetingInfo?.joinPolicy === 'passcode' && !passcode.trim()) {
      setPasscodeError('Please enter the passcode.');
      valid = false;
    } else {
      setPasscodeError('');
    }

    if (!valid) return;

    setState('joining');
    setErrorMsg('');
    saveDisplayName(trimmedName);

    try {
      // Check if we have a host key saved for this room
      const hostKey = loadHostKey(roomId) ?? undefined;

      await getMeetingToken({
        roomId,
        name: trimmedName,
        hostKey,
        passcode: passcode.trim() || undefined,
      });

      // Stop preview before navigating — the Room page will start its own streams
      stopPreview();

      // Pass initial device preferences and mute state via sessionStorage
      // so the Room page can pick them up without re-asking permissions
      sessionStorage.setItem(
        `sm:joinPrefs:${roomId}`,
        JSON.stringify({ selectedVideoId, selectedAudioId, camOn, micOn, name: trimmedName }),
      );

      navigate(`/room/${roomId}`);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'Could not join. Please try again.',
      );
      setState('ready');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <PageShell>
        <Spinner message="Checking meeting…" />
      </PageShell>
    );
  }

  if (state === 'not_found') {
    return (
      <PageShell>
        <div className="text-center flex flex-col gap-3">
          <p className="text-4xl">🔍</p>
          <h2 className="text-xl font-semibold">Meeting not found</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The link may have a typo, or the meeting was never created.
          </p>
          <a href="/" className="text-sm underline" style={{ color: 'var(--accent)' }}>
            Start a new meeting
          </a>
        </div>
      </PageShell>
    );
  }

  if (state === 'ended') {
    return (
      <PageShell>
        <div className="text-center flex flex-col gap-3">
          <p className="text-4xl">🏁</p>
          <h2 className="text-xl font-semibold">Meeting has ended</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The host ended this meeting.
          </p>
          <a href="/" className="text-sm underline" style={{ color: 'var(--accent)' }}>
            Start a new meeting
          </a>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            SyncMeet
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Ready to join?
          </p>
        </div>

        {/* Camera preview */}
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--surface)' }}
        >
          <video
            ref={previewVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{
              transform: 'scaleX(-1)',
              display: previewActive && camOn ? 'block' : 'none',
            }}
          />
          {(!previewActive || !camOn) && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'var(--surface-2)' }}
              >
                📷
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {previewActive ? 'Camera off' : 'Preview off'}
              </p>
            </div>
          )}

          {/* Permission denied overlay */}
          {permissionDenied && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl"
              style={{ background: 'rgba(224,82,82,0.15)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
                Camera/mic access denied
              </p>
              <p className="text-xs text-center px-4" style={{ color: 'var(--muted)' }}>
                You can still join. Enable them in your browser settings to share video/audio.
              </p>
            </div>
          )}
        </div>

        {/* Preview controls */}
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => setPreviewActive((v) => !v)}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: previewActive ? 'var(--accent)' : 'var(--surface)',
              color: previewActive ? '#fff' : 'var(--text)',
              border: '1px solid var(--surface-2)',
            }}
          >
            {previewActive ? 'Preview on' : 'Enable preview'}
          </button>

          {previewActive && (
            <>
              <button
                onClick={() => setCamOn((v) => !v)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: camOn ? 'var(--surface-2)' : 'var(--danger)',
                  color: 'var(--text)',
                }}
              >
                {camOn ? '📷 Cam on' : '📷 Cam off'}
              </button>
              <button
                onClick={() => setMicOn((v) => !v)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: micOn ? 'var(--surface-2)' : 'var(--danger)',
                  color: 'var(--text)',
                }}
              >
                {micOn ? '🎙 Mic on' : '🎙 Mic off'}
              </button>
            </>
          )}
        </div>

        {/* Device selectors — shown only after preview is active and devices are enumerated */}
        {previewActive && videoDevices.length > 1 && (
          <select
            value={selectedVideoId}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface-2)' }}
          >
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
        {previewActive && audioDevices.length > 1 && (
          <select
            value={selectedAudioId}
            onChange={(e) => setSelectedAudioId(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--surface-2)' }}
          >
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}

        {/* Join form */}
        <div
          className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface)' }}
        >
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Your name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={60}
              placeholder="Enter your name"
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: `1px solid ${nameError ? 'var(--danger)' : 'var(--surface-2)'}`,
                outline: 'none',
              }}
            />
            {nameError && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{nameError}</p>
            )}
          </div>

          {/* Passcode (only for passcode meetings) */}
          {meetingInfo?.joinPolicy === 'passcode' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Passcode *
              </label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setPasscodeError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={32}
                placeholder="Enter the meeting passcode"
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: `1px solid ${passcodeError ? 'var(--danger)' : 'var(--surface-2)'}`,
                  outline: 'none',
                }}
              />
              {passcodeError && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{passcodeError}</p>
              )}
            </div>
          )}

          {/* Waiting room notice */}
          {meetingInfo?.joinPolicy === 'waiting_room' && (
            <div
              className="text-xs p-3 rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
            >
              🚪 This meeting has a waiting room. The host will admit you after you join.
            </div>
          )}

          {/* Error */}
          {state === 'error' && errorMsg && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
          )}

          {state === 'joining' ? (
            <Spinner message="Joining…" />
          ) : (
            <button
              onClick={handleJoin}
              className="w-full py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Join meeting
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
}


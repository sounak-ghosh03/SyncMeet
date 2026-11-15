import { useState, useEffect, useCallback } from 'react';
import type { ParticipantInfo } from '@/lib/media';
import {
  listPendingGuests,
  admitGuest,
  denyGuest,
  muteAll,
  removeParticipant,
  type PendingGuest,
} from '@/lib/api';
import { XIcon, MicOffIcon, UsersIcon } from './Icons';

interface Props {
  roomId: string;
  participants: ParticipantInfo[];
  hostKey: string | null;      // null for guests
  isOpen: boolean;
  onClose: () => void;
  onWaitingCountChange: (n: number) => void;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Participant panel — shown as a sidebar inside the room.
 *
 * Host view:
 *  - Pending waiting-room guests with Admit / Deny buttons (polls every 3s)
 *  - Active participants list with Mute and Remove buttons
 *  - Mute All button in the header
 *
 * Guest view:
 *  - Read-only participant list (name + status indicators)
 */
export default function ParticipantPanel({
  roomId,
  participants,
  hostKey,
  isOpen,
  onClose,
  onWaitingCountChange,
}: Props) {
  const isHost = !!hostKey;
  const [pending, setPending] = useState<PendingGuest[]>([]);
  const [mutingAll, setMutingAll] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Poll pending guests while panel is open and viewer is host
  const fetchPending = useCallback(async () => {
    if (!hostKey || !isOpen) return;
    try {
      const guests = await listPendingGuests({ roomId, hostKey });
      setPending(guests);
      onWaitingCountChange(guests.length);
    } catch {
      // Network error — keep existing list
    }
  }, [roomId, hostKey, isOpen, onWaitingCountChange]);

  useEffect(() => {
    if (!isHost || !isOpen) return;
    fetchPending();
    const id = setInterval(fetchPending, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHost, isOpen, fetchPending]);

  async function handleAdmit(requestId: string) {
    if (!hostKey || actionInProgress) return;
    setActionInProgress(requestId);
    try {
      await admitGuest({ roomId, requestId, hostKey });
      setPending((prev) => prev.filter((g) => g.requestId !== requestId));
      onWaitingCountChange(pending.length - 1);
    } catch { /* idempotent — already handled server-side */ }
    setActionInProgress(null);
  }

  async function handleDeny(requestId: string) {
    if (!hostKey || actionInProgress) return;
    setActionInProgress(requestId);
    try {
      await denyGuest({ roomId, requestId, hostKey });
      setPending((prev) => prev.filter((g) => g.requestId !== requestId));
      onWaitingCountChange(pending.length - 1);
    } catch { /* ok */ }
    setActionInProgress(null);
  }

  async function handleMuteAll() {
    if (!hostKey || mutingAll) return;
    setMutingAll(true);
    try {
      await muteAll({ roomId, hostKey });
    } catch { /* best effort */ }
    setMutingAll(false);
  }

  async function handleRemove(identity: string) {
    if (!hostKey || actionInProgress) return;
    setActionInProgress(identity);
    try {
      await removeParticipant({ roomId, hostKey, identity });
    } catch { /* ok */ }
    setActionInProgress(null);
  }

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: '280px',
        borderLeft: '1px solid var(--surface-2)',
        background: 'var(--surface)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        <div className="flex items-center gap-2">
          <UsersIcon size={16} color="var(--muted)" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Participants ({participants.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={handleMuteAll}
              disabled={mutingAll}
              title="Mute everyone's microphone"
              className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
            >
              {mutingAll ? '…' : 'Mute all'}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close participants"
            style={{ color: 'var(--muted)' }}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── Waiting section (host only) ───────────────────────────── */}
        {isHost && pending.length > 0 && (
          <section>
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--surface-2)' }}
            >
              Waiting to join ({pending.length})
            </div>
            {pending.map((guest) => (
              <div
                key={guest.requestId}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--surface-2)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                  >
                    {guest.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span
                    className="text-sm truncate"
                    style={{ color: 'var(--text)' }}
                  >
                    {guest.name}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleAdmit(guest.requestId)}
                    disabled={actionInProgress === guest.requestId}
                    className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                    style={{ background: 'var(--speaker)', color: '#fff' }}
                  >
                    Admit
                  </button>
                  <button
                    onClick={() => handleDeny(guest.requestId)}
                    disabled={actionInProgress === guest.requestId}
                    className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', color: 'var(--danger)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Active participants ────────────────────────────────────── */}
        <section>
          {pending.length > 0 && isHost && (
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--surface-2)' }}
            >
              In the meeting ({participants.length})
            </div>
          )}
          {participants.map((p) => (
            <div
              key={p.identity}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--surface-2)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Speaking indicator */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: p.isSpeaking ? 'var(--speaker)' : 'var(--surface-2)',
                    color: p.isSpeaking ? '#fff' : 'var(--muted)',
                    transition: 'background 0.15s',
                  }}
                >
                  {p.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                    {p.name}
                    {p.isLocal && (
                      <span style={{ color: 'var(--muted)' }}> (you)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {!p.hasAudio && (
                      <MicOffIcon size={11} color="var(--danger)" />
                    )}
                    {!p.hasVideo && (
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        no cam
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Host controls — only show for other participants */}
              {isHost && !p.isLocal && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleRemove(p.identity)}
                    disabled={actionInProgress === p.identity}
                    title={`Remove ${p.name}`}
                    className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                    style={{ background: 'var(--surface-2)', color: 'var(--danger)' }}
                  >
                    {actionInProgress === p.identity ? '…' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {participants.length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>
              No participants yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

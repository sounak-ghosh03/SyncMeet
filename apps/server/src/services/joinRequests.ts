import { nanoid } from 'nanoid';
import { Meeting, type IJoinRequest } from '../models/Meeting.js';
import { createToken } from './livekit.js';

/** How long a pending join request is valid (5 minutes). */
const REQUEST_TTL_MS = 5 * 60 * 1000;

// ── Create join request (guest → server) ──────────────────────────────────

export async function createJoinRequest(
  roomId: string,
  name: string,
): Promise<{ requestId: string }> {
  const requestId = nanoid(32);
  await Meeting.findOneAndUpdate(
    { roomId },
    {
      $push: {
        joinRequests: {
          requestId,
          name,
          status: 'pending',
          token: null,
          createdAt: new Date(),
        },
      },
    },
  );
  return { requestId };
}

// ── Get single request (guest polling) ────────────────────────────────────

export type PollResult =
  | { status: 'pending' }
  | { status: 'admitted'; token: string; lkUrl: string }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'not_found' };

export async function pollJoinRequest(
  roomId: string,
  requestId: string,
  lkUrl: string,
): Promise<PollResult> {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return { status: 'not_found' };

  const req = meeting.joinRequests.find((r) => r.requestId === requestId);
  if (!req) return { status: 'not_found' };

  // Expire pending requests that are too old (edge case 12.3)
  if (
    req.status === 'pending' &&
    Date.now() - req.createdAt.getTime() > REQUEST_TTL_MS
  ) {
    return { status: 'expired' };
  }

  if (req.status === 'admitted' && req.token) {
    return { status: 'admitted', token: req.token, lkUrl };
  }
  if (req.status === 'denied') return { status: 'denied' };
  return { status: 'pending' };
}

// ── List pending requests (host view) ─────────────────────────────────────

export async function listPendingRequests(roomId: string): Promise<IJoinRequest[]> {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return [];
  return meeting.joinRequests.filter((r) => r.status === 'pending');
}

// ── Admit request (host → server) — idempotent ────────────────────────────

export async function admitJoinRequest(
  roomId: string,
  requestId: string,
): Promise<void> {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return;

  const req = meeting.joinRequests.find((r) => r.requestId === requestId);
  if (!req) return;
  // Idempotent: already admitted, nothing to do
  if (req.status === 'admitted') return;

  // Generate a token for the guest
  const token = await createToken(roomId, req.name, false);

  await Meeting.findOneAndUpdate(
    { roomId, 'joinRequests.requestId': requestId },
    { $set: { 'joinRequests.$.status': 'admitted', 'joinRequests.$.token': token } },
  );
}

// ── Deny request (host → server) — idempotent ─────────────────────────────

export async function denyJoinRequest(
  roomId: string,
  requestId: string,
): Promise<void> {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return;

  const req = meeting.joinRequests.find((r) => r.requestId === requestId);
  if (!req) return;
  // Idempotent: already denied, nothing to do
  if (req.status === 'denied') return;

  await Meeting.findOneAndUpdate(
    { roomId, 'joinRequests.requestId': requestId },
    { $set: { 'joinRequests.$.status': 'denied' } },
  );
}

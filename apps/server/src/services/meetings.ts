import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { Meeting, type IMeeting } from '../models/Meeting.js';
import { createToken } from './livekit.js';

const BCRYPT_ROUNDS = 10;

// ── Room ID generation ─────────────────────────────────────────────────────

/**
 * Generates a URL-safe, unguessable room ID in the format "abc-defgh-ijk".
 * nanoid uses a cryptographically secure RNG.
 */
function generateRoomId(): string {
  return `${nanoid(4)}-${nanoid(5)}-${nanoid(4)}`.toLowerCase();
}

// ── Create meeting ─────────────────────────────────────────────────────────

export interface CreateMeetingResult {
  roomId: string;
  hostKey: string;   // returned once to the host — the raw key, never stored
}

export async function createMeeting(opts: {
  joinPolicy: 'open' | 'waiting_room' | 'passcode';
  passcode?: string;
}): Promise<CreateMeetingResult> {
  const { joinPolicy, passcode } = opts;

  if (joinPolicy === 'passcode' && !passcode?.trim()) {
    throw new Error('A passcode is required when joinPolicy is "passcode".');
  }

  const roomId = generateRoomId();
  // The host key is a one-time secret returned at creation.
  // We only store its hash — never the raw value.
  const hostKey = nanoid(32);
  const hostKeyHash = await bcrypt.hash(hostKey, BCRYPT_ROUNDS);

  const passcodeHash =
    joinPolicy === 'passcode' && passcode
      ? await bcrypt.hash(passcode.trim(), BCRYPT_ROUNDS)
      : null;

  await Meeting.create({
    roomId,
    hostKeyHash,
    joinPolicy,
    passcodeHash,
  });

  return { roomId, hostKey };
}

// ── Get meeting (safe, no secrets) ────────────────────────────────────────

export interface MeetingPublicInfo {
  roomId: string;
  joinPolicy: 'open' | 'waiting_room' | 'passcode';
  endedAt: Date | null;
}

export async function getMeeting(roomId: string): Promise<IMeeting | null> {
  return Meeting.findOne({ roomId });
}

// ── Verify host key ────────────────────────────────────────────────────────

export async function verifyHostKey(
  meeting: IMeeting,
  hostKey: string,
): Promise<boolean> {
  return bcrypt.compare(hostKey, meeting.hostKeyHash);
}

// ── Verify passcode ────────────────────────────────────────────────────────

export async function verifyPasscode(
  meeting: IMeeting,
  passcode: string,
): Promise<boolean> {
  if (!meeting.passcodeHash) return false;
  return bcrypt.compare(passcode.trim(), meeting.passcodeHash);
}

// ── Issue token (enforces join policy) ────────────────────────────────────

export interface TokenRequestOpts {
  meeting: IMeeting;
  name: string;
  hostKey?: string;
  passcode?: string;
}

export async function issueToken(opts: TokenRequestOpts): Promise<string> {
  const { meeting, name, hostKey, passcode } = opts;

  // Refuse if the meeting has ended
  if (meeting.endedAt) {
    throw Object.assign(new Error('This meeting has ended.'), { status: 410 });
  }

  // Determine host status
  const isHost = hostKey ? await verifyHostKey(meeting, hostKey) : false;

  // Enforce join policy
  if (!isHost) {
    if (meeting.joinPolicy === 'passcode') {
      if (!passcode) {
        throw Object.assign(new Error('Passcode required.'), { status: 403 });
      }
      const ok = await verifyPasscode(meeting, passcode);
      if (!ok) {
        throw Object.assign(new Error('Incorrect passcode.'), { status: 403 });
      }
    }

    if (meeting.joinPolicy === 'waiting_room') {
      // Guests cannot call /token directly on a waiting-room meeting.
      // They must go through the join-request flow (Phase 4).
      // Edge case 12.3: "Calling /token directly on a waiting-room meeting — server refuses"
      throw Object.assign(
        new Error('This meeting uses a waiting room. Use the join-request flow.'),
        { status: 403 },
      );
    }
  }

  return createToken(meeting.roomId, name, isHost);
}

// ── End meeting ────────────────────────────────────────────────────────────

export async function endMeeting(meeting: IMeeting): Promise<void> {
  await Meeting.findOneAndUpdate(
    { roomId: meeting.roomId },
    { endedAt: new Date() },
  );
}

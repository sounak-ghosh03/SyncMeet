import { Router } from 'express';
import { z } from 'zod';
import {
  createMeeting,
  getMeeting,
  issueToken,
  verifyHostKey,
  endMeeting,
} from '../services/meetings.js';
import {
  createJoinRequest,
  pollJoinRequest,
  listPendingRequests,
  admitJoinRequest,
  denyJoinRequest,
} from '../services/joinRequests.js';
import { RoomServiceClient, TrackType } from 'livekit-server-sdk';
import { config } from '../config.js';

const router = Router();

// ── Shared Zod schemas ─────────────────────────────────────────────────────

const NameSchema = z.string().min(1, 'Name is required').max(60).trim();
const RoomIdParam = z.string().min(1);

// ── Helper: extract & validate roomId param ────────────────────────────────

function getRoomId(params: Record<string, string>): string | null {
  const result = RoomIdParam.safeParse(params.roomId);
  return result.success ? result.data : null;
}

// ── POST /api/meetings — create a meeting ──────────────────────────────────

const CreateMeetingBody = z.object({
  joinPolicy: z.enum(['open', 'waiting_room', 'passcode']).default('open'),
  passcode: z.string().min(4).max(32).trim().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const body = CreateMeetingBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }
    const { joinPolicy, passcode } = body.data;

    if (joinPolicy === 'passcode' && !passcode) {
      res.status(400).json({ error: 'Passcode is required when joinPolicy is "passcode".' });
      return;
    }

    const { roomId, hostKey } = await createMeeting({ joinPolicy, passcode });

    res.status(201).json({
      roomId,
      hostKey,  // shown once to the host, never stored raw
      joinLink: `${config.clientOrigin}/join/${roomId}`,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/meetings/:roomId — check a meeting exists ────────────────────

router.get('/:roomId', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }
    if (meeting.endedAt) {
      res.status(410).json({ error: 'This meeting has ended.' });
      return;
    }

    // Return only public info — never expose hashes
    res.json({
      roomId: meeting.roomId,
      joinPolicy: meeting.joinPolicy,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/meetings/:roomId/token — issue a LiveKit token ──────────────

const TokenBody = z.object({
  name: NameSchema,
  hostKey: z.string().optional(),
  passcode: z.string().optional(),
});

router.post('/:roomId/token', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const body = TokenBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }

    const meeting = await getMeeting(roomId);
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found.' });
      return;
    }

    try {
      const token = await issueToken({
        meeting,
        name: body.data.name,
        hostKey: body.data.hostKey,
        passcode: body.data.passcode,
      });
      res.json({ token, lkUrl: config.livekit.url });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ error: e.message ?? 'Token error.' });
    }
  } catch (err) {
    next(err);
  }
});

// ── POST /api/meetings/:roomId/end — host ends the meeting ────────────────

const EndBody = z.object({ hostKey: z.string().min(1) });

router.post('/:roomId/end', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const body = EndBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }
    if (meeting.endedAt) { res.status(410).json({ error: 'Already ended.' }); return; }

    const isHost = await verifyHostKey(meeting, body.data.hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    // Mark ended in DB
    await endMeeting(meeting);

    // Kick everyone from the LiveKit room
    try {
      const svc = new RoomServiceClient(
        config.livekit.url,
        config.livekit.apiKey,
        config.livekit.apiSecret,
      );
      await svc.deleteRoom(roomId);
    } catch {
      // Best-effort — if LiveKit call fails the meeting is still marked ended
    }

    res.json({ ended: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/meetings/:roomId/mute-all — host mutes all guests ───────────

const MuteAllBody = z.object({ hostKey: z.string().min(1) });

router.post('/:roomId/mute-all', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const body = MuteAllBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }
    if (meeting.endedAt) { res.status(410).json({ error: 'Meeting has ended.' }); return; }

    const isHost = await verifyHostKey(meeting, body.data.hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    const svc = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret,
    );

    // Target only audio tracks to avoid muting screen shares or video
    const participants = await svc.listParticipants(roomId);
    await Promise.all(
      participants.flatMap((p) => {
        const audioTracks = (p.tracks ?? []).filter(
          (t) => t.type === TrackType.AUDIO,
        );
        return audioTracks.map((t) =>
          svc.mutePublishedTrack(roomId, p.identity, t.sid, true),
        );
      }),
    );

    res.json({ mutedAll: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/meetings/:roomId/remove — host removes a participant ─────────

const RemoveBody = z.object({
  hostKey: z.string().min(1),
  identity: z.string().min(1),
});

router.post('/:roomId/remove', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const body = RemoveBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }
    if (meeting.endedAt) { res.status(410).json({ error: 'Meeting has ended.' }); return; }

    const isHost = await verifyHostKey(meeting, body.data.hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    const svc = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret,
    );
    await svc.removeParticipant(roomId, body.data.identity);

    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
});

// ── JOIN REQUEST ROUTES (waiting room) ────────────────────────────────────
// These routes implement section 11.4 of the implementation plan.

// POST /api/meetings/:roomId/join-requests — guest creates a request
const JoinRequestBody = z.object({
  name: z.string().min(1, 'Name is required').max(60).trim(),
});

router.post('/:roomId/join-requests', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const body = JoinRequestBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }
    if (meeting.endedAt) { res.status(410).json({ error: 'Meeting has ended.' }); return; }
    if (meeting.joinPolicy !== 'waiting_room') {
      res.status(400).json({ error: 'This meeting does not use a waiting room.' });
      return;
    }

    const { requestId } = await createJoinRequest(roomId, body.data.name);
    res.status(201).json({ requestId });
  } catch (err) { next(err); }
});

// GET /api/meetings/:roomId/join-requests/:requestId — guest polls status
router.get('/:roomId/join-requests/:requestId', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    const { requestId } = req.params;
    if (!roomId || !requestId) { res.status(400).json({ error: 'Invalid params.' }); return; }

    const result = await pollJoinRequest(roomId, requestId, config.livekit.url);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/meetings/:roomId/join-requests — host lists pending guests
router.get('/:roomId/join-requests', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    if (!roomId) { res.status(400).json({ error: 'Invalid room ID.' }); return; }

    const hostKey = req.headers['x-host-key'] as string | undefined;
    if (!hostKey) { res.status(403).json({ error: 'Host key required.' }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }

    const isHost = await verifyHostKey(meeting, hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    const pending = await listPendingRequests(roomId);
    res.json({ requests: pending.map((r) => ({ requestId: r.requestId, name: r.name })) });
  } catch (err) { next(err); }
});

// POST /api/meetings/:roomId/join-requests/:requestId/admit — host admits
const AdmitDenyBody = z.object({ hostKey: z.string().min(1) });

router.post('/:roomId/join-requests/:requestId/admit', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    const { requestId } = req.params;
    if (!roomId || !requestId) { res.status(400).json({ error: 'Invalid params.' }); return; }

    const body = AdmitDenyBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }

    const isHost = await verifyHostKey(meeting, body.data.hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    await admitJoinRequest(roomId, requestId);
    res.json({ admitted: true });
  } catch (err) { next(err); }
});

// POST /api/meetings/:roomId/join-requests/:requestId/deny — host denies
router.post('/:roomId/join-requests/:requestId/deny', async (req, res, next) => {
  try {
    const roomId = getRoomId(req.params);
    const { requestId } = req.params;
    if (!roomId || !requestId) { res.status(400).json({ error: 'Invalid params.' }); return; }

    const body = AdmitDenyBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.flatten() }); return; }

    const meeting = await getMeeting(roomId);
    if (!meeting) { res.status(404).json({ error: 'Meeting not found.' }); return; }

    const isHost = await verifyHostKey(meeting, body.data.hostKey);
    if (!isHost) { res.status(403).json({ error: 'Invalid host key.' }); return; }

    await denyJoinRequest(roomId, requestId);
    res.json({ denied: true });
  } catch (err) { next(err); }
});

export default router;


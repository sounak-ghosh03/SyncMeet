/**
 * Thin API client for the SyncMeet backend.
 * All fetch calls live here — components never call fetch directly.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(
      (payload as { error?: string }).error ?? `HTTP ${res.status}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Phase 1 (dev) ──────────────────────────────────────────────────────────

/**
 * Phase 1 only: request a token without a real meeting in the database.
 * Used to verify media works before building the full create/join flow.
 */
export async function getTestToken(params: {
  roomId: string;
  name: string;
  isHost?: boolean;
}): Promise<{ token: string; lkUrl: string }> {
  return request('POST', '/api/dev/test-token', params);
}

// ── Phase 2+ meetings API ──────────────────────────────────────────────────

export type JoinPolicy = 'open' | 'waiting_room' | 'passcode';

export interface CreateMeetingResult {
  roomId: string;
  hostKey: string;
  joinLink: string;
}

export async function createMeeting(params: {
  joinPolicy: JoinPolicy;
  passcode?: string;
}): Promise<CreateMeetingResult> {
  return request('POST', '/api/meetings', params);
}

export interface MeetingInfo {
  roomId: string;
  joinPolicy: JoinPolicy;
}

export async function getMeetingInfo(roomId: string): Promise<MeetingInfo> {
  return request('GET', `/api/meetings/${roomId}`);
}

export interface TokenResult {
  token: string;
  lkUrl: string;
}

export async function getMeetingToken(params: {
  roomId: string;
  name: string;
  hostKey?: string;
  passcode?: string;
}): Promise<TokenResult> {
  const { roomId, ...body } = params;
  return request('POST', `/api/meetings/${roomId}/token`, body);
}

export async function endMeeting(params: {
  roomId: string;
  hostKey: string;
}): Promise<void> {
  await request('POST', `/api/meetings/${params.roomId}/end`, { hostKey: params.hostKey });
}

export async function muteAll(params: {
  roomId: string;
  hostKey: string;
}): Promise<void> {
  await request('POST', `/api/meetings/${params.roomId}/mute-all`, { hostKey: params.hostKey });
}

export async function removeParticipant(params: {
  roomId: string;
  hostKey: string;
  identity: string;
}): Promise<void> {
  await request('POST', `/api/meetings/${params.roomId}/remove`, {
    hostKey: params.hostKey,
    identity: params.identity,
  });
}

// ── Join request (waiting room) API ───────────────────────────────────────

export async function createJoinRequest(params: {
  roomId: string;
  name: string;
}): Promise<{ requestId: string }> {
  return request('POST', `/api/meetings/${params.roomId}/join-requests`, { name: params.name });
}

export type PollStatus =
  | { status: 'pending' }
  | { status: 'admitted'; token: string; lkUrl: string }
  | { status: 'denied' }
  | { status: 'expired' };

export async function pollJoinRequest(params: {
  roomId: string;
  requestId: string;
}): Promise<PollStatus> {
  return request('GET', `/api/meetings/${params.roomId}/join-requests/${params.requestId}`);
}

export interface PendingGuest {
  requestId: string;
  name: string;
}

export async function listPendingGuests(params: {
  roomId: string;
  hostKey: string;
}): Promise<PendingGuest[]> {
  const data = await request<{ requests: PendingGuest[] }>(
    'GET',
    `/api/meetings/${params.roomId}/join-requests`,
    undefined,
    { 'x-host-key': params.hostKey },
  );
  return data.requests;
}

export async function admitGuest(params: {
  roomId: string;
  requestId: string;
  hostKey: string;
}): Promise<void> {
  await request('POST', `/api/meetings/${params.roomId}/join-requests/${params.requestId}/admit`, {
    hostKey: params.hostKey,
  });
}

export async function denyGuest(params: {
  roomId: string;
  requestId: string;
  hostKey: string;
}): Promise<void> {
  await request('POST', `/api/meetings/${params.roomId}/join-requests/${params.requestId}/deny`, {
    hostKey: params.hostKey,
  });
}


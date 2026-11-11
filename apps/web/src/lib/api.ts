/**
 * Thin API client for the SyncMeet backend.
 * All fetch calls live here — components never call fetch directly.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

// ── Phase 2+ endpoints will be added here ─────────────────────────────────


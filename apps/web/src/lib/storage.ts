/**
 * Thin wrappers around sessionStorage and localStorage for SyncMeet data.
 *
 * hostKey lives in sessionStorage so it survives page refresh within the same
 * tab, but is cleared when the tab is closed (edge case 12.2).
 *
 * displayName lives in localStorage so the PreJoin field is pre-filled on
 * future visits, but can be overridden.
 *
 * Layout preference (grid vs speaker) also lives in localStorage (section 11.3).
 */

const KEY_HOST_KEY = (roomId: string) => `sm:hostKey:${roomId}`;
const KEY_NAME = 'sm:displayName';
const KEY_LAYOUT = 'sm:layout';

// ── Host key ──────────────────────────────────────────────────────────────

export function saveHostKey(roomId: string, hostKey: string): void {
  try {
    sessionStorage.setItem(KEY_HOST_KEY(roomId), hostKey);
  } catch { /* storage unavailable */ }
}

export function loadHostKey(roomId: string): string | null {
  try {
    return sessionStorage.getItem(KEY_HOST_KEY(roomId));
  } catch {
    return null;
  }
}

export function clearHostKey(roomId: string): void {
  try {
    sessionStorage.removeItem(KEY_HOST_KEY(roomId));
  } catch { /* ok */ }
}

// ── Display name ──────────────────────────────────────────────────────────

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(KEY_NAME, name);
  } catch { /* ok */ }
}

export function loadDisplayName(): string {
  try {
    return localStorage.getItem(KEY_NAME) ?? '';
  } catch {
    return '';
  }
}

// ── Pending token (waiting room → room handoff) ───────────────────────────
// Stored briefly so the Room page can use the already-issued token
// instead of calling getMeetingToken again.

const KEY_PENDING_TOKEN = (roomId: string) => `sm:pendingToken:${roomId}`;
const KEY_PENDING_LKURL = (roomId: string) => `sm:pendingLkUrl:${roomId}`;

export function savePendingToken(roomId: string, token: string, lkUrl: string): void {
  try {
    sessionStorage.setItem(KEY_PENDING_TOKEN(roomId), token);
    sessionStorage.setItem(KEY_PENDING_LKURL(roomId), lkUrl);
  } catch { /* ok */ }
}

export function loadPendingToken(roomId: string): { token: string; lkUrl: string } | null {
  try {
    const token = sessionStorage.getItem(KEY_PENDING_TOKEN(roomId));
    const lkUrl = sessionStorage.getItem(KEY_PENDING_LKURL(roomId));
    if (!token || !lkUrl) return null;
    return { token, lkUrl };
  } catch { return null; }
}

export function clearPendingToken(roomId: string): void {
  try {
    sessionStorage.removeItem(KEY_PENDING_TOKEN(roomId));
    sessionStorage.removeItem(KEY_PENDING_LKURL(roomId));
  } catch { /* ok */ }
}

export type LayoutMode = 'grid' | 'speaker';

export function saveLayout(mode: LayoutMode): void {
  try {
    localStorage.setItem(KEY_LAYOUT, mode);
  } catch { /* ok */ }
}

export function loadLayout(): LayoutMode {
  try {
    const v = localStorage.getItem(KEY_LAYOUT);
    return v === 'speaker' ? 'speaker' : 'grid';
  } catch {
    return 'grid';
  }
}

// ── Layout preference ─────────────────────────────────────────────────────

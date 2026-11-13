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

// ── Layout preference ─────────────────────────────────────────────────────

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


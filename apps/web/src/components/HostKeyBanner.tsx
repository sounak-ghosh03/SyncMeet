import { useState } from 'react';

interface Props {
  hostKey: string;
  joinLink: string;
  onDismiss: () => void;
}

/**
 * One-time host key banner.
 * Appears after meeting creation and stores the key in sessionStorage.
 * Shows the key once with a copy button (edge case 12.2).
 */
export default function HostKeyBanner({ hostKey, joinLink, onDismiss }: Props) {
  const [copied, setCopied] = useState<'key' | 'link' | null>(null);

  async function copy(text: string, which: 'key' | 'link') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div
      className="w-full max-w-lg rounded-xl p-5 flex flex-col gap-4 shadow-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
            Your meeting is ready
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Save your host key — it won't be shown again. You need it to end the
            meeting or rejoin as host after a refresh.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-lg leading-none shrink-0"
          style={{ color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>

      {/* Host key row */}
      <div className="flex items-center gap-2">
        <code
          className="flex-1 text-xs px-3 py-2 rounded-lg select-all truncate"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          {hostKey}
        </code>
        <button
          onClick={() => copy(hostKey, 'key')}
          className="text-xs px-3 py-2 rounded-lg shrink-0"
          style={{
            background: copied === 'key' ? 'var(--speaker)' : 'var(--accent)',
            color: '#fff',
          }}
        >
          {copied === 'key' ? 'Copied!' : 'Copy key'}
        </button>
      </div>

      {/* Join link row */}
      <div className="flex items-center gap-2">
        <span
          className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
        >
          {joinLink}
        </span>
        <button
          onClick={() => copy(joinLink, 'link')}
          className="text-xs px-3 py-2 rounded-lg shrink-0"
          style={{
            background: copied === 'link' ? 'var(--speaker)' : 'var(--surface-2)',
            color: 'var(--text)',
          }}
        >
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}


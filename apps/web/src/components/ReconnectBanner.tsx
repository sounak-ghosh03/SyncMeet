interface Props {
  isReconnecting: boolean;
}

/**
 * Slim banner shown at the top of the room when LiveKit is reconnecting.
 * Disappears automatically when the connection is restored.
 */
export default function ReconnectBanner({ isReconnecting }: Props) {
  if (!isReconnecting) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium animate-pulse shrink-0"
      style={{ background: 'var(--danger)', color: '#fff' }}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block w-2 h-2 rounded-full bg-white opacity-80" />
      Reconnecting… your connection dropped. Trying to restore.
    </div>
  );
}

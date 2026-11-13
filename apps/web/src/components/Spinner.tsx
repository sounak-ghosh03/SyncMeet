interface Props {
  message?: string;
}

/** Spinning loader shown while async work is in progress */
export default function Spinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: 'var(--surface-2)',
          borderTopColor: 'var(--accent)',
        }}
      />
      {message && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
}


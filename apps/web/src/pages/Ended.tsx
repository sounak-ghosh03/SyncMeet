import PageShell from '@/components/PageShell';

/** Shown when the host has explicitly ended the meeting for everyone. */
export default function EndedPage() {
  return (
    <PageShell>
      <div className="text-center flex flex-col items-center gap-4">
        <p className="text-5xl">🏁</p>
        <h1 className="text-2xl font-bold">Meeting ended</h1>
        <p className="text-sm max-w-xs" style={{ color: 'var(--muted)' }}>
          The host has ended this meeting for everyone.
        </p>
        <a
          href="/"
          className="mt-2 px-6 py-3 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Start a new meeting
        </a>
      </div>
    </PageShell>
  );
}


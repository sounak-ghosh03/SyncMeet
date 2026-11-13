import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

/** Full-screen centered layout used by non-meeting pages (Home, PreJoin, Ended) */
export default function PageShell({ children, className = '' }: Props) {
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 ${className}`}
      style={{ background: 'var(--bg)' }}
    >
      {children}
    </div>
  );
}


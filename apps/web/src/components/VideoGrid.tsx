import { useState, useEffect } from 'react';
import type { ParticipantInfo } from '@/lib/media';
import VideoTile from './VideoTile';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import type { LayoutMode } from '@/lib/storage';

interface Props {
  participants: ParticipantInfo[];
  layout: LayoutMode;
  hostIdentity: string | null; // the local host's identity if known
}

/** How many tiles to show per page */
const PAGE_SIZE = 9;

/**
 * VideoGrid renders all participant tiles in grid or speaker view.
 *
 * Grid view  — equal tiles, CSS grid, paginated at PAGE_SIZE.
 * Speaker view — one large main tile (active speaker or screen share),
 *               plus a horizontally-scrollable strip of small tiles.
 *
 * Both views read from the same participant list — switching is a pure
 * rendering change with no reconnect (section 11.3 of the plan).
 */
export default function VideoGrid({ participants, layout, hostIdentity }: Props) {
  const [page, setPage] = useState(0);

  // Reset to page 0 when participant count drops below current page boundary
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(participants.length / PAGE_SIZE) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [participants.length, page]);
  // Build the flat tile list: each participant gets a camera tile, plus an
  // extra screen-share tile if they are sharing.
  interface TileDescriptor {
    identity: string;
    name: string;
    isSpeaking: boolean;
    isLocal: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
    isScreen: boolean;
    isHost: boolean;
  }

  const tiles: TileDescriptor[] = participants.flatMap((p) => {
    const base: TileDescriptor = {
      identity: p.identity,
      name: p.name,
      isSpeaking: p.isSpeaking,
      isLocal: p.isLocal,
      hasVideo: p.hasVideo,
      hasAudio: p.hasAudio,
      isScreen: false,
      isHost: p.identity === hostIdentity || (p.isLocal && !!hostIdentity && p.isLocal),
    };
    if (p.isScreenSharing) {
      return [base, { ...base, isScreen: true }];
    }
    return [base];
  });

  // Find the active screen share tile (if any)
  const screenTile = tiles.find((t) => t.isScreen);

  // Active speaker — first non-local speaking participant, or the first participant
  const activeSpeakerTile =
    tiles.find((t) => t.isSpeaking && !t.isLocal && !t.isScreen) ??
    tiles.find((t) => !t.isLocal && !t.isScreen) ??
    tiles.find((t) => !t.isScreen);

  if (tiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: 'var(--muted)' }} className="text-sm">
          Waiting for others to join…
        </p>
      </div>
    );
  }

  // ── Speaker view ──────────────────────────────────────────────────────────

  if (layout === 'speaker') {
    // Main tile: prefer screen share, then active speaker
    const mainTile = screenTile ?? activeSpeakerTile ?? tiles[0];
    // Strip: all other tiles
    const stripTiles = tiles.filter((t) => t !== mainTile);

    return (
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden min-h-0">
        {/* Main large tile */}
        <div className="flex-1 min-h-0">
          <VideoTile
            key={`${mainTile.identity}-${mainTile.isScreen}`}
            {...mainTile}
            size="large"
            isHost={mainTile.isHost}
          />
        </div>

        {/* Strip of small tiles */}
        {stripTiles.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ height: '110px', flexShrink: 0 }}
          >
            {stripTiles.map((t) => (
              <div
                key={`${t.identity}-${t.isScreen}`}
                style={{ width: '160px', flexShrink: 0 }}
              >
                <VideoTile {...t} size="small" isHost={t.isHost} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────────

  // Paginate (Phase 4 will add prev/next controls; for now show first PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(tiles.length / PAGE_SIZE));
  const visibleTiles = tiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const count = visibleTiles.length;

  // Responsive column count
  const cols =
    count === 1 ? 1
    : count <= 2 ? 2
    : count <= 4 ? 2
    : count <= 9 ? 3
    : 4;

  return (
    <div className="flex-1 flex flex-col p-2 overflow-hidden min-h-0 gap-2">
      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '8px',
          gridAutoRows: `calc((100% - ${(Math.ceil(count / cols) - 1) * 8}px) / ${Math.ceil(count / cols)})`,
        }}
      >
        {visibleTiles.map((t) => (
          <VideoTile
            key={`${t.identity}-${t.isScreen}`}
            {...t}
            isHost={t.isHost}
          />
        ))}
      </div>

      {/* Pagination controls — only shown when there are multiple pages */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 shrink-0 py-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {page + 1} / {totalPages}
            <span className="ml-2">({tiles.length} participants)</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

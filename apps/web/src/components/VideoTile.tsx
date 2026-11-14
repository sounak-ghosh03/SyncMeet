import { Track } from 'livekit-client';
import { useRoomCtx } from '@/context/RoomContext';
import { useParticipantTrack } from '@/hooks/useParticipantTrack';
import { MicOffIcon } from './Icons';

export interface VideoTileProps {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isLocal: boolean;
  hasVideo: boolean;    // camera on and not muted
  hasAudio: boolean;    // mic on and not muted
  isScreen: boolean;    // if true, renders the screen-share track instead of camera
  size?: 'normal' | 'large' | 'small';
  isHost?: boolean;
}

export default function VideoTile({
  identity,
  name,
  isSpeaking,
  isLocal,
  hasVideo,
  hasAudio,
  isScreen,
  size = 'normal',
  isHost = false,
}: VideoTileProps) {
  const room = useRoomCtx();
  const source = isScreen ? Track.Source.ScreenShare : Track.Source.Camera;
  const videoRef = useParticipantTrack(room, identity, source, isLocal);

  // For screen share tiles, use contain (no cropping). Camera tiles use cover.
  const objectFit = isScreen ? 'contain' : 'cover';

  // Active speaker ring color
  const speakerBorder = isSpeaking && !isScreen
    ? '2px solid var(--speaker)'
    : '2px solid transparent';

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarSize = size === 'large' ? 'w-20 h-20 text-2xl' : 'w-12 h-12 text-lg';

  return (
    <div
      className="relative w-full h-full overflow-hidden rounded-xl flex items-center justify-center select-none"
      style={{
        background: 'var(--surface)',
        border: speakerBorder,
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Video element — always rendered, hidden when no video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Mute local video element to prevent audio echo (we never play back own audio)
        muted={isLocal || isScreen}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          // Mirror local camera video (not screen share)
          transform: isLocal && !isScreen ? 'scaleX(-1)' : 'none',
          display: (isScreen || hasVideo) ? 'block' : 'none',
        }}
      />

      {/* Avatar placeholder — shown when camera is off or screen share not started */}
      {!hasVideo && !isScreen && (
        <div className="flex flex-col items-center gap-2">
          <div
            className={`${avatarSize} rounded-full flex items-center justify-center font-semibold`}
            style={{ background: stringToColor(identity), color: '#fff' }}
          >
            {initials || '?'}
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--muted)' }}
          >
            {name}
          </span>
        </div>
      )}

      {/* Screen share placeholder — shown before the track attaches */}
      {isScreen && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          {/* Background is visible through the transparent video */}
        </div>
      )}

      {/* Bottom gradient + name label */}
      <div
        className="tile-name absolute bottom-0 left-0 right-0 px-3 py-2 flex items-end justify-between"
      >
        <span
          className="text-xs font-medium truncate max-w-[80%]"
          style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          {isScreen ? `${name}'s screen` : name}
          {isLocal && !isScreen && ' (you)'}
        </span>

        <div className="flex items-center gap-1">
          {isHost && !isScreen && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Host
            </span>
          )}
          {!hasAudio && !isScreen && (
            <MicOffIcon size={14} color="var(--danger)" />
          )}
        </div>
      </div>

      {/* Screen share badge on the tile owner's screen */}
      {isScreen && isLocal && (
        <div
          className="absolute top-2 left-2 text-xs px-2 py-1 rounded-full"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Sharing
        </div>
      )}
    </div>
  );
}

/**
 * Deterministic color from a string — gives each participant a unique avatar color.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 38%)`;
}

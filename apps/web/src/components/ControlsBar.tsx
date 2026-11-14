import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenShareIcon,
  ScreenShareOffIcon,
  ChatIcon,
  PhoneOffIcon,
  GridIcon,
  SpeakerViewIcon,
} from "./Icons";
import type { LayoutMode } from "@/lib/storage";

interface Props {
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  layout: LayoutMode;
  isHost: boolean;
  screenshareBlocked: boolean; // true when another participant is already sharing

  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleLayout: () => void;
  onLeave: () => void;
  onEndMeeting: () => void;
}

/**
 * Bottom controls bar for the meeting room.
 * Keyboard shortcuts: M = mic, V = video, S = screen share, C = chat
 */
export default function ControlsBar({
  micOn,
  camOn,
  isScreenSharing,
  isChatOpen,
  unreadCount,
  layout,
  isHost,
  screenshareBlocked,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleChat,
  onToggleLayout,
  onLeave,
  onEndMeeting,
}: Props) {
  return (
    <div
      className="flex items-center justify-between px-6 py-3 gap-3"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--surface-2)",
        flexShrink: 0,
      }}
    >
      {/* Left — layout toggle */}
      <div className="flex items-center gap-2">
        <ControlBtn
          label={layout === "grid" ? "Speaker view" : "Grid view"}
          onClick={onToggleLayout}
          title={
            layout === "grid" ? "Switch to speaker view" : "Switch to grid view"
          }
        >
          {layout === "grid" ? (
            <SpeakerViewIcon size={18} />
          ) : (
            <GridIcon size={18} />
          )}
        </ControlBtn>
      </div>

      {/* Center — media controls */}
      <div className="flex items-center gap-3">
        {/* Mic */}
        <ControlBtn
          label={micOn ? "Mute (M)" : "Unmute (M)"}
          onClick={onToggleMic}
          active={micOn}
          danger={!micOn}
          title={micOn ? "Mute microphone (M)" : "Unmute microphone (M)"}
        >
          {micOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
        </ControlBtn>

        {/* Camera */}
        <ControlBtn
          label={camOn ? "Stop video (V)" : "Start video (V)"}
          onClick={onToggleCam}
          active={camOn}
          danger={!camOn}
          title={camOn ? "Turn off camera (V)" : "Turn on camera (V)"}
        >
          {camOn ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
        </ControlBtn>

        {/* Screen share */}
        <div className="relative">
          <ControlBtn
            label={isScreenSharing ? "Stop sharing (S)" : "Share screen (S)"}
            onClick={onToggleScreenShare}
            active={!isScreenSharing}
            accent={isScreenSharing}
            disabled={screenshareBlocked && !isScreenSharing}
            title={
              screenshareBlocked && !isScreenSharing
                ? "Someone else is already sharing"
                : isScreenSharing
                  ? "Stop screen share (S)"
                  : "Share your screen (S)"
            }
          >
            {isScreenSharing ? (
              <ScreenShareOffIcon size={20} />
            ) : (
              <ScreenShareIcon size={20} />
            )}
          </ControlBtn>
          {screenshareBlocked && !isScreenSharing && (
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs px-2 py-1 rounded pointer-events-none"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              Someone is sharing
            </div>
          )}
        </div>

        {/* Chat toggle */}
        <div className="relative">
          <ControlBtn
            label={isChatOpen ? "Close chat (C)" : "Open chat (C)"}
            onClick={onToggleChat}
            active={!isChatOpen}
            accent={isChatOpen}
            title="Toggle chat panel (C)"
          >
            <ChatIcon size={20} />
          </ControlBtn>
          {unreadCount > 0 && !isChatOpen && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Right — leave / end */}
      <div className="flex items-center gap-2">
        {isHost && (
          <button
            onClick={onEndMeeting}
            title="End meeting for everyone"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: "transparent",
              color: "var(--danger)",
              border: "1px solid var(--danger)",
            }}
          >
            End
          </button>
        )}
        <button
          onClick={onLeave}
          title="Leave meeting"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--danger)", color: "#fff" }}
        >
          <PhoneOffIcon size={16} />
          Leave
        </button>
      </div>
    </div>
  );
}

// ── Helper component ─────────────────────────────────────────────────────────

interface ControlBtnProps {
  children: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  active?: boolean; // "on" state — reserved for future visual treatment
  danger?: boolean; // "off" / muted state — red background
  accent?: boolean; // "active feature" state — accent color
  disabled?: boolean;
}

function ControlBtn({
  children,
  label,
  title,
  onClick,
  // active is accepted for API consistency but bg logic uses danger/accent only
  active: _active = true,
  danger = false,
  accent = false,
  disabled = false,
}: ControlBtnProps) {
  const bg = danger
    ? "var(--danger)"
    : accent
      ? "var(--accent)"
      : "var(--surface-2)";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        className="w-11 h-11 rounded-full flex items-center justify-center transition-opacity"
        style={{
          background: bg,
          color: "#fff",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {children}
      </button>
      <span
        className="text-[10px] hidden sm:block"
        style={{ color: "var(--muted)" }}
      >
        {label.split(" (")[0]}
      </span>
    </div>
  );
}

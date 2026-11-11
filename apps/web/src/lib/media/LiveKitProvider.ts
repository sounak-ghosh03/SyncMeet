import {
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
  DataPacket_Kind,
  ConnectionState,
} from 'livekit-client';
import type {
  MediaProvider,
  MediaEventType,
  ChatMessage,
  ParticipantInfo,
} from './types.js';

type AnyCallback = (...args: unknown[]) => void;

/**
 * LiveKit implementation of MediaProvider.
 *
 * The UI never imports from livekit-client directly — it always goes through
 * this class via the MediaProvider interface. When we add WebRtcMeshProvider
 * or MediasoupProvider, we simply create a new class that implements the same
 * interface and wire it up with the env flag.
 */
export class LiveKitProvider implements MediaProvider {
  private room: Room;
  private listeners: Map<MediaEventType, Set<AnyCallback>> = new Map();

  constructor() {
    this.room = new Room({
      // Adaptive stream: subscribers get smaller streams for small tiles.
      adaptiveStream: true,
      // Dynacast: only publish simulcast layers that are actually subscribed to.
      dynacast: true,
    });

    this.attachRoomEvents();
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async connect(roomId: string, token: string): Promise<void> {
    const lkUrl = import.meta.env.VITE_LK_URL as string;
    if (!lkUrl) throw new Error('VITE_LK_URL is not set');

    await this.room.connect(lkUrl, token);
    this.emitParticipants();
  }

  async disconnect(): Promise<void> {
    await this.room.disconnect();
  }

  // ── Media controls ─────────────────────────────────────────────────────────

  async setMicEnabled(on: boolean): Promise<void> {
    await this.room.localParticipant.setMicrophoneEnabled(on);
  }

  async setCameraEnabled(on: boolean): Promise<void> {
    await this.room.localParticipant.setCameraEnabled(on);
  }

  async setScreenShareEnabled(on: boolean): Promise<void> {
    await this.room.localParticipant.setScreenShareEnabled(on);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  sendChat(text: string): void {
    // Cap message length to prevent flooding (edge case 12.6).
    const safeText = text.slice(0, 500);
    const payload = JSON.stringify({ type: 'chat', text: safeText });
    const encoder = new TextEncoder();
    this.room.localParticipant.publishData(
      encoder.encode(payload),
      { reliable: true },
    );
  }

  // ── Event system ───────────────────────────────────────────────────────────

  on(event: 'participants', cb: (participants: ParticipantInfo[]) => void): void;
  on(event: 'chat', cb: (msg: ChatMessage) => void): void;
  on(event: 'disconnected', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  on(event: MediaEventType, cb: AnyCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: MediaEventType, cb: AnyCallback): void {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: MediaEventType, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  // ── Internal LiveKit event wiring ─────────────────────────────────────────

  private attachRoomEvents(): void {
    const { room } = this;

    // Participant list changes
    const refreshParticipants = () => this.emitParticipants();
    room.on(RoomEvent.ParticipantConnected, refreshParticipants);
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
    room.on(RoomEvent.LocalTrackPublished, refreshParticipants);
    room.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
    room.on(RoomEvent.TrackPublished, refreshParticipants);
    room.on(RoomEvent.TrackUnpublished, refreshParticipants);
    room.on(RoomEvent.TrackSubscribed, refreshParticipants);
    room.on(RoomEvent.TrackUnsubscribed, refreshParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);

    // Chat data messages
    room.on(RoomEvent.DataReceived, (data, participant) => {
      try {
        const decoder = new TextDecoder();
        const parsed = JSON.parse(decoder.decode(data)) as unknown;
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'type' in parsed &&
          (parsed as { type: unknown }).type === 'chat' &&
          'text' in parsed
        ) {
          const msg: ChatMessage = {
            // Use LiveKit identity — cannot be spoofed by the sender (edge case 12.6)
            identity: participant?.identity ?? 'unknown',
            senderName: participant?.name ?? participant?.identity ?? 'Unknown',
            // Render as plain text only; never set innerHTML (XSS prevention)
            text: String((parsed as { text: unknown }).text),
            timestamp: Date.now(),
          };
          this.emit('chat', msg);
        }
      } catch {
        // Silently drop malformed messages
      }
    });

    // Disconnection / meeting ended
    room.on(RoomEvent.Disconnected, () => {
      this.emit('disconnected');
    });

    // Connection state errors
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (state === ConnectionState.Disconnected) {
        this.emit('disconnected');
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Returns the underlying Room so components can attach video elements. */
  getRoom(): Room {
    return this.room;
  }

  private buildParticipantInfo(
    p: LocalParticipant | RemoteParticipant,
    isLocal: boolean,
  ): ParticipantInfo {
    const tracks = p.getTrackPublications();
    const hasVideo = [...tracks.values()].some(
      (t) => t.kind === 'video' && t.trackName !== 'screen' && !t.isMuted,
    );
    const hasAudio = [...tracks.values()].some(
      (t) => t.kind === 'audio' && !t.isMuted,
    );
    const isScreenSharing = [...tracks.values()].some(
      (t) => t.source === 'screen_share',
    );

    return {
      identity: p.identity,
      name: p.name ?? p.identity,
      isSpeaking: p.isSpeaking,
      isLocal,
      hasVideo,
      hasAudio,
      isScreenSharing,
    };
  }

  private emitParticipants(): void {
    const local = this.buildParticipantInfo(this.room.localParticipant, true);
    const remotes = [...this.room.remoteParticipants.values()].map((p) =>
      this.buildParticipantInfo(p, false),
    );
    this.emit('participants', [local, ...remotes]);
  }
}


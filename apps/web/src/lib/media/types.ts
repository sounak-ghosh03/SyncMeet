/**
 * MediaProvider — the single interface the UI uses to talk to the media layer.
 *
 * All React components and hooks must import from here, never from livekit-client
 * directly. This lets us swap LiveKit for a raw WebRTC mesh or mediasoup later
 * by changing the active provider (section 5 of the implementation plan).
 */

export type MediaEventType =
  | 'participants'
  | 'chat'
  | 'tracks'
  | 'disconnected'
  | 'error';

export interface ChatMessage {
  /** The LiveKit participant identity (server-assigned, not spoofable) */
  identity: string;
  /** The display name of the sender */
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ParticipantInfo {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isLocal: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  isScreenSharing: boolean;
}

export interface MediaProvider {
  connect(roomId: string, token: string): Promise<void>;
  disconnect(): Promise<void>;

  setMicEnabled(on: boolean): Promise<void>;
  setCameraEnabled(on: boolean): Promise<void>;
  setScreenShareEnabled(on: boolean): Promise<void>;

  sendChat(text: string): void;

  /**
   * Register an event listener.
   * - 'participants' fires with ParticipantInfo[] whenever the list changes.
   * - 'chat'         fires with ChatMessage when a new message arrives.
   * - 'disconnected' fires when the connection drops or the room ends.
   * - 'error'        fires with an Error on unexpected failures.
   */
  on(event: 'participants', cb: (participants: ParticipantInfo[]) => void): void;
  on(event: 'chat', cb: (msg: ChatMessage) => void): void;
  on(event: 'disconnected', cb: () => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  off(event: MediaEventType, cb: (...args: unknown[]) => void): void;
}


/**
 * Public barrel for the media abstraction layer.
 *
 * Import MediaProvider types and the active provider from here.
 * Never import livekit-client directly in components.
 */
export type { MediaProvider, ChatMessage, ParticipantInfo, MediaEventType } from './types.js';
export { LiveKitProvider } from './LiveKitProvider.js';


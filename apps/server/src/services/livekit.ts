import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config.js';

/**
 * Generates a short-lived LiveKit JWT for a participant.
 *
 * @param roomId   - The LiveKit room name
 * @param name     - Display name shown in the UI
 * @param isHost   - Whether to grant roomAdmin privileges
 * @returns        A signed JWT string
 */
export async function createToken(
  roomId: string,
  name: string,
  isHost: boolean,
): Promise<string> {
  // Append a random suffix so two tabs with the same display name
  // get different identities and do not kick each other out.
  const identity = `${name}-${crypto.randomUUID().slice(0, 8)}`;

  const at = new AccessToken(
    config.livekit.apiKey,
    config.livekit.apiSecret,
    {
      identity,
      name,
      ttl: '2h',
    },
  );

  at.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isHost,
  });

  return at.toJwt();
}


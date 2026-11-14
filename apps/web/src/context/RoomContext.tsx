import { createContext, useContext } from 'react';
import type { Room } from 'livekit-client';

/**
 * Provides the LiveKit Room object to any component inside the meeting.
 * Components use useRoomCtx() to access tracks and participant data directly.
 * This is intentionally LiveKit-specific — video rendering is implementation-specific
 * and doesn't belong behind the abstract MediaProvider interface.
 */
const RoomCtx = createContext<Room | null>(null);

export const RoomProvider = RoomCtx.Provider;

export function useRoomCtx(): Room {
  const room = useContext(RoomCtx);
  if (!room) throw new Error('useRoomCtx must be called inside <RoomProvider>');
  return room;
}

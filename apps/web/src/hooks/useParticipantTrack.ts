import { useEffect, useRef, useState } from 'react';
import { Track, ParticipantEvent, type Room } from 'livekit-client';

/**
 * Attaches a LiveKit video track to a <video> element and keeps it in sync.
 *
 * Returns a ref to assign to your <video> element. The hook handles:
 * - Initial attachment when the component mounts
 * - Re-attachment when the track changes (e.g. user switches camera)
 * - Detachment on unmount or when the track is unpublished/unsubscribed
 * - Screen share tracks (pass source = Track.Source.ScreenShare)
 *
 * NOTE: This hook is LiveKit-specific. If we add another provider, we'd
 * write a provider-specific equivalent.
 */
export function useParticipantTrack(
  room: Room,
  identity: string,
  source: Track.Source,
  isLocal: boolean,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Store the track object itself — when it changes (new pub or switch) we re-attach
  const [track, setTrack] = useState<Track | null>(null);

  useEffect(() => {
    const participant = isLocal
      ? room.localParticipant
      : room.remoteParticipants.get(identity);

    if (!participant) return;

    const updateTrack = () => {
      const pub = participant.getTrackPublication(source);
      const t = pub?.track ?? null;
      setTrack((prev) => (prev === t ? prev : t)); // avoid re-renders if same ref
    };

    updateTrack(); // run immediately for initial state

    participant.on(ParticipantEvent.TrackPublished, updateTrack);
    participant.on(ParticipantEvent.TrackUnpublished, updateTrack);
    participant.on(ParticipantEvent.TrackSubscribed, updateTrack);
    participant.on(ParticipantEvent.TrackUnsubscribed, updateTrack);
    participant.on(ParticipantEvent.TrackMuted, updateTrack);
    participant.on(ParticipantEvent.TrackUnmuted, updateTrack);

    return () => {
      participant.off(ParticipantEvent.TrackPublished, updateTrack);
      participant.off(ParticipantEvent.TrackUnpublished, updateTrack);
      participant.off(ParticipantEvent.TrackSubscribed, updateTrack);
      participant.off(ParticipantEvent.TrackUnsubscribed, updateTrack);
      participant.off(ParticipantEvent.TrackMuted, updateTrack);
      participant.off(ParticipantEvent.TrackUnmuted, updateTrack);
    };
  }, [room, identity, source, isLocal]);

  // Attach / detach when track changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;

    track.attach(el);

    return () => {
      track.detach(el);
    };
  }, [track]);

  return videoRef;
}

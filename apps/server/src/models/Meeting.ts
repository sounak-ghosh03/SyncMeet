import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Join request sub-document ──────────────────────────────────────────────

export interface IJoinRequest {
  requestId: string;       // random, unguessable
  name: string;            // display name the guest entered
  status: 'pending' | 'admitted' | 'denied';
  createdAt: Date;
}

const JoinRequestSchema = new Schema<IJoinRequest>(
  {
    requestId: { type: String, required: true },
    name:      { type: String, required: true, maxlength: 60 },
    status:    { type: String, enum: ['pending', 'admitted', 'denied'], default: 'pending' },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

// ── Meeting document ───────────────────────────────────────────────────────

export interface IMeeting extends Document {
  roomId: string;
  hostKeyHash: string;

  joinPolicy: 'open' | 'waiting_room' | 'passcode';
  passcodeHash: string | null;

  joinRequests: IJoinRequest[];

  createdAt: Date;
  endedAt: Date | null;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    roomId:      { type: String, required: true, unique: true, index: true },
    hostKeyHash: { type: String, required: true },

    joinPolicy:   { type: String, enum: ['open', 'waiting_room', 'passcode'], default: 'open' },
    passcodeHash: { type: String, default: null },

    joinRequests: { type: [JoinRequestSchema], default: [] },

    createdAt: { type: Date, default: () => new Date() },
    endedAt:   { type: Date, default: null },
  },
  { versionKey: false },
);

// TTL index — automatically remove meetings that were never ended after 24 hours
// (edge case 12.8: stale meetings). MongoDB evaluates this once per minute.
MeetingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const Meeting: Model<IMeeting> = mongoose.model<IMeeting>('Meeting', MeetingSchema);


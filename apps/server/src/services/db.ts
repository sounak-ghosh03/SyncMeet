import mongoose from 'mongoose';
import { config } from '../config.js';

let connected = false;

/**
 * Connect to MongoDB Atlas. Idempotent — safe to call multiple times.
 * Uses Mongoose's built-in connection pooling and auto-reconnect.
 */
export async function connectDB(): Promise<void> {
  if (connected) return;
  await mongoose.connect(config.mongodb.uri);
  connected = true;
  console.log('[db] connected to MongoDB');
}


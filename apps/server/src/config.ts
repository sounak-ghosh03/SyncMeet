import 'dotenv/config';

/**
 * Central configuration loaded from environment variables.
 * All env access should go through this module — never import process.env directly.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  livekit: {
    url: requireEnv('LK_URL'),
    apiKey: requireEnv('LK_API_KEY'),
    apiSecret: requireEnv('LK_API_SECRET'),
  },
  mongodb: {
    uri: requireEnv('MONGODB_URI'),
  },
} as const;


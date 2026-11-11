import { Router } from 'express';
import { z } from 'zod';
import { createToken } from '../services/livekit.js';

/**
 * Phase 1 – test route only.
 * Generates a token for any room/name without touching the database.
 * This route will be REPLACED in Phase 2 by the full meetings router.
 */
const router = Router();

const TestTokenBody = z.object({
  roomId: z.string().min(1).max(100),
  name: z.string().min(1).max(60).trim(),
  isHost: z.boolean().optional().default(false),
});

router.post('/test-token', async (req, res, next) => {
  try {
    const body = TestTokenBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.flatten() });
      return;
    }
    const { roomId, name, isHost } = body.data;
    const token = await createToken(roomId, name, isHost);
    res.json({ token, lkUrl: process.env.LK_URL });
  } catch (err) {
    next(err);
  }
});

export default router;


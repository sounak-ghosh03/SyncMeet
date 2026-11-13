import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDB } from './services/db.js';
import devRouter from './routes/dev.js';
import meetingsRouter from './routes/meetings.js';

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: config.clientOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────────────────────

// Phase 1: dev-only token endpoint (no DB needed)
app.use('/api/dev', devRouter);

// Phase 2+: full meetings API
app.use('/api/meetings', meetingsRouter);

// ── Global error handler ────────────────────────────────────────────────────

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

// ── Start ───────────────────────────────────────────────────────────────────

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[server] listening on http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('[server] failed to connect to MongoDB:', err);
    process.exit(1);
  });

export default app;


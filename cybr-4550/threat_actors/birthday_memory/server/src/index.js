import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { initSchema, pool } from './db.js';
import birthdaysRouter from './routes.js';
import { login, logout, me, requireAuth } from './auth.js';

export const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// Security headers (CSP, X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
// Replaces the previous zero-header baseline.
app.use(helmet());

// CORS: restricted to the app's own client origin instead of `cors()`'s previous
// default of reflecting every origin. `credentials: true` is required so the
// browser will send the httpOnly session cookie cross-port (5173 -> 4000).
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// General rate limit across the whole API - mitigates the unbounded-request /
// resource-exhaustion condition identified in the threat model (Boundary 1, DoS row).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api', apiLimiter);

// Tighter limit specifically on login attempts - brute-force / credential-stuffing
// mitigation, separate from the general API limit above.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait before trying again.' },
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'thebirthdates' });
  } catch (error) {
    res.status(503).json({ status: 'degraded', error: error.message });
  }
});

app.post('/api/auth/login', loginLimiter, (req, res, next) =>
  login(req, res).catch(next),
);
app.post('/api/auth/logout', requireAuth, logout);
app.get('/api/auth/me', requireAuth, me);

// Every birthday record route now requires a valid session - this is the primary
// Domain 1 fix: previously every one of these was reachable with zero credentials.
app.use('/api/birthdays', requireAuth, birthdaysRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function start() {
  try {
    await initSchema();
    console.log('[db] schema ready on "thebirthdates"');
  } catch (error) {
    console.error('[db] could not initialize schema:', error.message);
    console.error('[db] is Postgres running? Try: npm run db:up');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
  });
}

// Only auto-start the HTTP server when this file is run directly (npm run dev / start).
// When imported as a module (e.g. by the Supertest regression suite), the caller controls
// startup instead - importing `app` must never have the side effect of binding a port or
// exiting the test process via `process.exit(1)` from a missing-DB check.
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

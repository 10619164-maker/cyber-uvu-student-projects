// The Express app definition, with NO side effects on import - no port binding, no
// process.exit(), no DB schema initialization. Safe for the Supertest regression suite
// (server/test/*.test.js) to import directly. server/src/index.js is the actual startup
// entry point (npm run dev / start) - it imports `app` from here and adds the real
// listen()/initSchema() startup sequence.
//
// (Previously this all lived in index.js itself, guarded by
// `if (import.meta.url === \`file://${process.argv[1]}\`)` so importing it for tests
// wouldn't also start a real server. That comparison is fragile on Windows - import.meta.url
// uses forward-slash file:// URLs while process.argv[1] is a raw backslash path, and through
// npm/concurrently/node --watch's layers of process spawning the two never matched, so the
// guard silently evaluated false and the server never started - with zero error output,
// since nothing actually threw. Splitting the file removes the need for that guard entirely.)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import birthdaysRouter from './routes.js';
import { login, logout, me, requireAuth } from './auth.js';

export const app = express();
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

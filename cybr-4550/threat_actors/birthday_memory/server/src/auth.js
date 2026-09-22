import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const COOKIE_NAME = 'birthday_memory_token';
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour - short-lived by design; re-login is cheap for this tool.

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (need >= 32 chars). Set it in server/.env - see server/.env.example.',
    );
  }
  return secret;
}

function cookieOptions() {
  return {
    httpOnly: true, // not readable from client-side JS - mitigates token theft via XSS
    sameSite: 'strict', // not sent on cross-site requests - primary CSRF mitigation for this app
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  };
}

export async function hashPassword(plain) {
  return argon2.hash(plain, { type: argon2.argon2id });
}

async function findUserByUsername(username) {
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username],
  );
  return rows[0] ?? null;
}

/** POST /api/auth/login */
export async function login(req, res) {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');

  // Generic error for both "no such user" and "wrong password" - do not reveal which,
  // to avoid username enumeration.
  const genericError = () => res.status(401).json({ error: 'Invalid username or password.' });

  if (!username || !password) return genericError();

  const user = await findUserByUsername(username);
  if (!user) {
    // Still run a hash verify against a dummy value so the response-time difference between
    // "user not found" and "wrong password" doesn't itself leak which case occurred (timing
    // side-channel / user enumeration mitigation).
    await argon2.hash('constant-time-decoy').catch(() => {});
    return genericError();
  }

  const valid = await argon2.verify(user.password_hash, password).catch(() => false);
  if (!valid) return genericError();

  const token = jwt.sign({ sub: user.id, username: user.username }, requireSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });

  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ username: user.username });
}

/** POST /api/auth/logout */
export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

/** GET /api/auth/me - lets the client check whether its session cookie is still valid. */
export function me(req, res) {
  res.json({ username: req.user.username });
}

/** Middleware: rejects any request without a valid, unexpired session cookie. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, requireSecret());
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication required.' });
  }
}

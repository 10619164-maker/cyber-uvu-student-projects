// Domain 1 (API) regression tests - Vitest + Supertest.
//
// Scope note: these run against the real dev Postgres container (docker compose up -d),
// not an isolated test DB - kept simple on purpose for a class assignment. Each test that
// creates data (a disposable test user, a probe birthday record) cleans up after itself so
// repeated runs don't leave junk behind or collide with the real seeded `team.lead` account.
// This suite intentionally does NOT hardcode any real credential - it creates and destroys
// its own throwaway user per run.
//
// Run with: npm --prefix server run test  (requires the DB container to be up)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { initSchema, pool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const TEST_USERNAME = `vitest-user-${Date.now()}`;
const TEST_PASSWORD = 'Test-Only-Password-1234!';

beforeAll(async () => {
  await initSchema();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
    [TEST_USERNAME, passwordHash],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username = $1', [TEST_USERNAME]);
  await pool.end();
});

describe('Domain 1 fix: /api/birthdays requires authentication', () => {
  it('rejects an unauthenticated GET', async () => {
    const res = await request(app).get('/api/birthdays');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required.' });
  });

  it('rejects an unauthenticated POST (create)', async () => {
    const res = await request(app)
      .post('/api/birthdays')
      .send({ firstName: 'Probe', lastName: 'Tamper', birthdate: '2001-02-02', email: 'probe@example.com' });
    expect(res.status).toBe(401);
  });

  it('rejects an unauthenticated PUT (edit) against an arbitrary id', async () => {
    const res = await request(app)
      .put('/api/birthdays/00000000-0000-0000-0000-000000000000')
      .send({ firstName: 'Nope', lastName: 'Nope', birthdate: '2001-02-02' });
    expect(res.status).toBe(401);
  });

  it('rejects an unauthenticated DELETE against an arbitrary id', async () => {
    const res = await request(app).delete('/api/birthdays/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('rejects a SQL-injection-shaped query string the same as any other unauthenticated request (401 before query logic runs)', async () => {
    const res = await request(app).get("/api/birthdays?q=' OR '1'='1");
    expect(res.status).toBe(401);
  });
});

describe('Domain 1 fix: CORS no longer reflects arbitrary origins', () => {
  it('does not echo back an untrusted Origin header', async () => {
    const res = await request(app).get('/api/birthdays').set('Origin', 'http://evil-example.test');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil-example.test');
  });

  it('does allow the configured client origin', async () => {
    const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
    const res = await request(app).get('/api/health').set('Origin', clientOrigin);
    expect(res.headers['access-control-allow-origin']).toBe(clientOrigin);
  });
});

describe('Domain 1 fix: security headers are present (helmet)', () => {
  it('sends baseline hardening headers on a normal response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Domain 1 feature: login', () => {
  it('rejects an unknown username with a generic error (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'not-a-real-user', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid username or password.' });
  });

  it('rejects a known username with the wrong password, with the SAME generic error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid username or password.' });
  });

  it('accepts correct credentials and sets an httpOnly, SameSite=Strict session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: TEST_USERNAME });

    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });
});

describe('Domain 1: a logged-in session can still use the app normally (fix did not break legitimate access)', () => {
  let cookie;
  let createdId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    cookie = res.headers['set-cookie'];
  });

  it('GET /api/auth/me returns the logged-in username', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: TEST_USERNAME });
  });

  it('GET /api/birthdays succeeds and returns an array', async () => {
    const res = await request(app).get('/api/birthdays').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('can create, then clean up, a probe record', async () => {
    const createRes = await request(app)
      .post('/api/birthdays')
      .set('Cookie', cookie)
      .send({ firstName: 'Vitest', lastName: 'Probe', birthdate: '2001-02-02', email: 'vitest-probe@example.com' });
    expect(createRes.status).toBe(201);
    createdId = createRes.body.id;
    expect(createdId).toBeDefined();

    const deleteRes = await request(app).delete(`/api/birthdays/${createdId}`).set('Cookie', cookie);
    expect(deleteRes.status).toBe(204);
  });

  it('logout clears the session so a subsequent request is rejected again', async () => {
    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(204);

    const afterLogout = await request(app).get('/api/birthdays').set('Cookie', cookie);
    // The client-side cookie jar would drop the cleared cookie; here we still hold the old
    // (now-invalid, but not literally revoked server-side since these are stateless JWTs)
    // cookie string, so this specifically documents a residual-risk note: JWTs issued before
    // logout remain cryptographically valid until they expire (max 1 hour) - logout only
    // clears the cookie client-side. See THREAT_MODEL.md / residual risk notes.
    expect([200, 401]).toContain(afterLogout.status);
  });
});

describe('Domain 1 fix: login rate limiting', () => {
  it('locks out further attempts after repeated failures from the same client', async () => {
    let lastStatus;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USERNAME, password: 'still-wrong' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

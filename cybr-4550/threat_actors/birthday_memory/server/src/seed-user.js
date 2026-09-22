import 'dotenv/config';
import crypto from 'node:crypto';
import { pool, initSchema } from './db.js';
import { hashPassword } from './auth.js';

/**
 * Creates one team account for local testing. Never hardcodes a password:
 * - if ADMIN_PASSWORD is set in the environment, uses that (so you can pick a known
 *   password for demo/testing purposes)
 * - otherwise generates a random one and prints it ONCE - it is never stored in
 *   plaintext anywhere, only its argon2 hash goes into the database.
 * This directly fixes the "hardcoded default credentials" finding for this table
 * (the birthdays DB connection's own default-credential fix is a separate, Domain 2 change).
 */
async function seedUser() {
  await initSchema();

  const username = process.env.ADMIN_USERNAME || 'team.lead';
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (rows.length > 0) {
    console.log(`[seed-user] user "${username}" already exists, skipping`);
    await pool.end();
    return;
  }

  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(password);

  await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [
    username,
    passwordHash,
  ]);

  console.log(`[seed-user] created user "${username}"`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`[seed-user] generated password (shown once, not stored anywhere): ${password}`);
    console.log('[seed-user] save this now - it will not be shown again.');
  }
  await pool.end();
}

seedUser().catch((error) => {
  console.error('[seed-user] failed:', error.message);
  process.exit(1);
});

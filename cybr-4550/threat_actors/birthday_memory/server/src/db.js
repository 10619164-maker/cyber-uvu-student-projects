import pg from 'pg';

// `birthdate` is a DATE column. node-postgres parses DATE into a JS Date in the
// server's local timezone, which can shift the day by one. Keep it as a string.
pg.types.setTypeParser(1082, (value) => value);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy server/.env.example to server/.env and fill in a real value ` +
        '(matching the credentials in your root .env used by docker-compose.yml) before starting the server. ' +
        'Refusing to fall back to a guessable default credential (Domain 2 fix - see docs/assessment/DOMAIN2-DATABASE.md).',
    );
  }
  return value;
}

const {
  DATABASE_URL,
  PGHOST = 'localhost',
  PGPORT = '5544',
  PGDATABASE = 'thebirthdates',
  PGSSL,
} = process.env;

// Domain 2 fix: PGUSER/PGPASSWORD used to default to 'birthday'/'birthday', matching
// docker-compose.yml's own (also-fixed) dev defaults - a hardcoded, guessable, publicly
// visible credential pair. Proven exploitable directly (bypassing the API and its auth
// entirely) in docs/assessment/testing/domain2-db-before-evidence.txt. Now: fail fast
// instead of silently falling back to a known-weak credential.
const PGUSER = DATABASE_URL ? process.env.PGUSER : requireEnv('PGUSER');
const PGPASSWORD = DATABASE_URL ? process.env.PGPASSWORD : requireEnv('PGPASSWORD');

// Domain 2 fix: PGSSL=true used to set { rejectUnauthorized: false }, which accepts ANY
// server certificate including a forged one - that defeats the point of using TLS at all
// (trivially MITM-able). Now PGSSL=true validates the server certificate properly by
// default. PGSSL_ALLOW_SELF_SIGNED is a separate, explicitly-named escape hatch for a
// local/dev Postgres with a self-signed cert - never intended past localhost.
// Note: the Postgres container this project runs (postgres:16-alpine via docker-compose,
// unmodified) does not have server-side SSL enabled at all, so PGSSL is not exercised in
// this local dev setup either before or after this fix - the fix addresses what the code
// would do if pointed at a TLS-enabled Postgres (e.g. a managed cloud instance), not a
// live local vulnerability. See docs/assessment/DOMAIN2-DATABASE.md.
let ssl;
if (PGSSL === 'true') {
  ssl = process.env.PGSSL_ALLOW_SELF_SIGNED === 'true' ? { rejectUnauthorized: false } : true;
}

export const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, ssl })
  : new pg.Pool({
      host: PGHOST,
      port: Number(PGPORT),
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      ssl,
    });

pool.on('error', (error) => {
  console.error('[db] unexpected pool error:', error.message);
});

export async function initSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS birthdays (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name  text NOT NULL,
      last_name   text NOT NULL,
      birthdate   date NOT NULL,
      phone       text,
      email       text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS birthdays_name_idx
      ON birthdays (lower(last_name), lower(first_name))
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS birthdays_month_day_idx
      ON birthdays (
        (EXTRACT(MONTH FROM birthdate)),
        (EXTRACT(DAY FROM birthdate))
      )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username      text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export function mapRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthdate: row.birthdate,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

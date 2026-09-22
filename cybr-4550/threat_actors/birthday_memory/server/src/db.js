import pg from 'pg';

// `birthdate` is a DATE column. node-postgres parses DATE into a JS Date in the
// server's local timezone, which can shift the day by one. Keep it as a string.
pg.types.setTypeParser(1082, (value) => value);

const {
  DATABASE_URL,
  PGHOST = 'localhost',
  PGPORT = '5544',
  PGUSER = 'birthday',
  PGPASSWORD = 'birthday',
  PGDATABASE = 'thebirthdates',
  PGSSL,
} = process.env;

const ssl = PGSSL === 'true' ? { rejectUnauthorized: false } : undefined;

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

  // Domain 1 (API) hardening: backing table for authenticated team accounts.
  // NOTE: PGUSER/PGPASSWORD fallback defaults above are a separate, tracked finding
  // (Domain 2 - Database) and are addressed in that domain's remediation pass, not here.
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

// Domain 2 (Database) - direct-connection evidence capture.
//
// This bypasses the Express API entirely and connects straight to the Postgres container
// on its published port (5544, from docker-compose.yml), using whatever credentials are
// passed in below. The point: prove (not assume) whether the database's OWN credentials -
// separate from anything the API's auth layer does - are guessable/hardcoded and whether
// the port is reachable with them.
//
// Usage:
//   node server/scripts/domain2-db-direct-connect-test.mjs <user> <password> <label> [--expect-fail]
//
// Run from the project root. Appends a transcript to
// docs/assessment/testing/domain2-db-<label>-evidence.txt

import pg from 'pg';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';

const [, , user, password, label, ...rest] = process.argv;
const expectFail = rest.includes('--expect-fail');

if (!user || !password || !label) {
  console.error('Usage: node domain2-db-direct-connect-test.mjs <user> <password> <label> [--expect-fail]');
  process.exit(1);
}

const outDir = 'docs/assessment/testing';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/domain2-db-${label}-evidence.txt`;
if (!existsSync(outPath)) {
  writeFileSync(outPath, `Domain 2 Database - "${label}" direct-connection evidence - captured ${new Date().toISOString()}\n`);
}

function log(line) {
  console.log(line);
  appendFileSync(outPath, `${line}\n`);
}

log(`\n===== Attempting direct connection to localhost:5544 as user "${user}" (no TLS requested) =====`);

const client = new pg.Client({
  host: 'localhost',
  port: 5544,
  user,
  password,
  database: 'thebirthdates',
  ssl: false,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  log('Connection SUCCEEDED.');

  const countRes = await client.query('SELECT COUNT(*)::int AS count FROM birthdays');
  log(`Row count in "birthdays": ${countRes.rows[0].count}`);

  const sampleRes = await client.query(
    'SELECT first_name, last_name, email, phone FROM birthdays ORDER BY created_at LIMIT 1',
  );
  log(`Sample row (synthetic seed data): ${JSON.stringify(sampleRes.rows[0])}`);

  await client.end();

  if (expectFail) {
    log('!! UNEXPECTED: this connection was expected to FAIL (old/guessable credentials should no longer work) but it SUCCEEDED.');
    process.exit(1);
  } else {
    log('Result: full read access to the PII table achieved using only these credentials, with zero interaction with the Express API or its auth layer.');
  }
} catch (error) {
  log(`Connection FAILED: ${error.message}`);
  if (expectFail) {
    log('Result: as expected - these credentials are no longer valid.');
  } else {
    log('!! UNEXPECTED: this connection was expected to SUCCEED but it FAILED.');
    process.exit(1);
  }
}

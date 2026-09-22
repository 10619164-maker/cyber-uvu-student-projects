// Domain 3 (Container) - port exposure evidence capture.
//
// docker-compose.yml currently publishes Postgres as "5544:5432" with no bind address,
// which Docker defaults to 0.0.0.0 - listening on ALL of the host's network interfaces,
// not just loopback. This connects to the Postgres container using a LAN-facing IP
// address of this machine (instead of localhost/127.0.0.1) to prove that anyone else on
// the same network - not just this computer - can reach the database port directly.
// (Domain 2's credential fix still applies here - this is a separate, additional layer:
// even correct credentials shouldn't be reachable from the whole LAN by default.)
//
// Usage: node server/scripts/domain3-port-exposure-test.mjs <lan-ip> <user> <password> <label>
// Run from the project root. Appends to docs/assessment/testing/domain3-container-<label>-evidence.txt

import pg from 'pg';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';

const [, , host, user, password, label] = process.argv;
if (!host || !user || !password || !label) {
  console.error('Usage: node domain3-port-exposure-test.mjs <lan-ip> <user> <password> <label>');
  process.exit(1);
}

const outDir = 'docs/assessment/testing';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/domain3-container-${label}-evidence.txt`;
if (!existsSync(outPath)) {
  writeFileSync(outPath, `Domain 3 Container - "${label}" port-exposure evidence - captured ${new Date().toISOString()}\n`);
}

function log(line) {
  console.log(line);
  appendFileSync(outPath, `${line}\n`);
}

log(`\n===== Attempting connection to ${host}:5544 (a LAN-facing IP of this machine, NOT localhost) =====`);

const client = new pg.Client({
  host,
  port: 5544,
  user,
  password,
  database: 'thebirthdates',
  ssl: false,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  log('Connection SUCCEEDED - the database port is reachable from this machine\'s LAN-facing address.');
  const countRes = await client.query('SELECT COUNT(*)::int AS count FROM birthdays');
  log(`Row count in "birthdays": ${countRes.rows[0].count}`);
  log('Result: any other device on the same network segment as this one could reach this port and, with valid credentials, read every record - not just processes on this machine.');
  await client.end();
} catch (error) {
  log(`Connection FAILED: ${error.message}`);
  log('Result: the database port is NOT reachable from this LAN-facing address - only loopback/this-machine traffic can reach it.');
}

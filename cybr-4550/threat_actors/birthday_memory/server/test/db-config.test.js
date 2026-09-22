// Domain 2 (Database) regression test.
//
// db.js used to default PGUSER/PGPASSWORD to 'birthday'/'birthday' when unset - a
// hardcoded, guessable credential, proven directly exploitable (bypassing the API
// entirely) in docs/assessment/testing/domain2-db-before-evidence.txt. This test asserts
// the fix: importing db.js without those env vars set now throws immediately with a
// clear message, instead of silently falling back to a known-weak default.
//
// Each case spawns a genuinely separate Node process with its own explicit env (rather
// than mutating process.env in-place and re-importing db.js within this same test
// process). That's deliberate, not just cautious: an earlier version of this test did
// exactly that in-process, and its env mutations leaked into other test files running in
// the same Vitest worker, causing unrelated tests to fail with "PGUSER is not set". A
// separate child process is fully isolated - its env can never affect this test process
// or any other test file, and this closely mirrors how the real app actually starts up.
// Uses `pathToFileURL()` rather than hand-building a file:// string, for the same reason
// server/src/index.js was fixed this session - a manually-built Windows file:// URL
// (backslashes, missing the third slash before the drive letter) silently fails.

import { describe, it, expect } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFileUrl = pathToFileURL(path.resolve(__dirname, '../src/db.js')).href;

function tryImportDb(envOverrides) {
  const script = `import(${JSON.stringify(dbFileUrl)}).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, ...envOverrides },
    encoding: 'utf-8',
    timeout: 10_000,
  });
}

describe('Domain 2 fix: db.js refuses to fall back to a guessable default credential', () => {
  it('throws a clear error when PGUSER is unset and there is no DATABASE_URL', () => {
    const result = tryImportDb({ DATABASE_URL: '', PGUSER: '', PGPASSWORD: 'some-password' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/PGUSER is not set/);
  });

  it('throws a clear error when PGPASSWORD is unset and there is no DATABASE_URL', () => {
    const result = tryImportDb({ DATABASE_URL: '', PGUSER: 'some-user', PGPASSWORD: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/PGPASSWORD is not set/);
  });

  it('does NOT fall back to the old guessable default credential (regression guard)', () => {
    const result = tryImportDb({ DATABASE_URL: '', PGUSER: '', PGPASSWORD: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toMatch(/'birthday'/);
  });

  it('loads successfully when PGUSER and PGPASSWORD are both set', () => {
    const result = tryImportDb({ DATABASE_URL: '', PGUSER: 'some-user', PGPASSWORD: 'some-password' });
    expect(result.status).toBe(0);
  });

  it('does not require PGUSER/PGPASSWORD when DATABASE_URL is set instead', () => {
    const result = tryImportDb({
      DATABASE_URL: 'postgresql://someone:something@localhost:5544/thebirthdates',
      PGUSER: '',
      PGPASSWORD: '',
    });
    expect(result.status).toBe(0);
  });
});

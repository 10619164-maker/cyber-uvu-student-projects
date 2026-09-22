# Domain 2 (Database) — Remediation Notes

## Findings (from the roadmap in THREAT_MODEL.md)

1. **Hardcoded, guessable default database credentials** (`birthday` / `birthday`), set in
   both `docker-compose.yml` (the actual running Postgres role) and `server/.env.example`
   (the API's connection settings) — publicly visible in this repo before remediation.
2. **TLS misconfiguration**: `PGSSL=true` previously set `{ rejectUnauthorized: false }`,
   which accepts *any* server certificate, including a forged one — this defeats the
   purpose of using TLS at all (a trivially MITM-able configuration).

## Test first, report what you proved

Before changing anything, `server/scripts/domain2-db-direct-connect-test.mjs` connected
directly to the Postgres container's published port (5544) using the literal credentials
`birthday` / `birthday`, with **zero involvement from the Express API or its auth layer**
(the Domain 1 fix). It succeeded, returned the full row count, and read a sample record —
see `docs/assessment/testing/domain2-db-before-evidence.txt`. This proves the finding is
real and directly exploitable, not just a theoretical bad practice: anyone who reads this
public repo already has full read/write access to every record in the database, entirely
independent of any authentication added to the API in Domain 1.

## What was fixed

- **Credentials**: `docker-compose.yml` now sources `POSTGRES_DB`/`POSTGRES_USER`/
  `POSTGRES_PASSWORD` from a root-level `.env` (gitignored) instead of hardcoding them,
  using Compose's `${VAR:?error message}` syntax so `docker compose up` fails loudly and
  clearly if that file is missing or incomplete, rather than silently starting with an
  empty or still-guessable value. `server/src/db.js`'s `PGUSER`/`PGPASSWORD` lost their
  `'birthday'` fallback defaults and now throw a clear startup error via a `requireEnv()`
  helper if unset — the same fail-fast pattern already used for `JWT_SECRET` in
  `auth.js`. Because the existing Docker volume was already initialized with the old
  password (Postgres only applies `POSTGRES_PASSWORD` on first volume creation, not on
  every restart), the fix required recreating the volume from scratch rather than just
  editing config — acceptable here since all data is synthetic and trivially reseeded.
- **TLS**: `PGSSL=true` now validates the server certificate properly by default. A
  separate, explicitly-named `PGSSL_ALLOW_SELF_SIGNED=true` escape hatch exists only for
  a local/dev Postgres with a self-signed cert — never intended past localhost.

## Scoped out (documented, not implemented) — and why

The roadmap listed two further "consider" items for this domain. Both were evaluated and
deliberately left as residual risk / future work rather than implemented, to keep this
domain's changes focused and testable rather than sprawling into a much larger redesign:

- **Privilege separation** (a schema-owning "init" role distinct from a lower-privilege
  "runtime" role for the API's day-to-day queries). The current single-role design means
  the API's own database credentials could, in principle, be used to alter or drop
  tables, not just read/write rows — a real defense-in-depth gap. Implementing this
  properly needs a second Postgres role provisioned via `docker-entrypoint-initdb.d` init
  scripts, a migration step to `GRANT` only `SELECT`/`INSERT`/`UPDATE`/`DELETE` on
  specific tables to the runtime role, and the app switching to use it for normal
  queries while a separate, more-privileged connection handles `initSchema()`. That's a
  meaningful architecture change on its own, not a small patch on top of this domain's
  credential fix — recommended as follow-up work, not attempted here.
- **Encryption at rest for PII columns** (`phone`, `email`, and arguably `first_name`/
  `last_name`/`birthdate`). `pgcrypto` is already enabled in this database (used today
  for `gen_random_uuid()`), so column-level encryption via `pgp_sym_encrypt`/
  `pgp_sym_decrypt` is technically available without adding a new extension. It was not
  implemented because it introduces real key-management questions (where does the
  encryption key live — a new required env var, so now a THIRD secret to keep in sync
  across environments alongside the DB password and JWT secret — and what's the story
  for key rotation) that go beyond what a local single-developer dev/demo app can
  meaningfully model, and because the volume itself is already local-only, not exposed to
  the internet, and holds synthetic data. Recommended as a forward-looking recommendation
  in the board report, not a gap treated as "fixed."

## Verification

`docs/assessment/testing/domain2-db-before-evidence.txt` — proves the old default
credentials worked (before any change).
`docs/assessment/testing/domain2-db-after-evidence.txt` — proves the old default
credentials no longer work, and that the new, non-guessable credentials do (after the
fix, live).
`server/test/db-config.test.js` — automated regression test asserting `db.js` throws
instead of falling back to a guessable default when `PGUSER`/`PGPASSWORD` are unset.

# B3 — Verification, Scanner Deltas, and Residual Risk Statement

This consolidates verification evidence across all three remediation domains (B2).
Per-domain narrative detail lives in `THREAT_MODEL.md`'s roadmap and
`DOMAIN2-DATABASE.md` / `DOMAIN3-CONTAINER.md`; this document is the single place that
ties scanner results and every deliberately-scoped-out item together.

## Dependency vulnerability scan (`npm audit`)

Run after all three domains' remediation was complete and committed.

**Server** (`npm --prefix server audit`):
```
@vitest/mocker  2.1.0 - 4.1.10
Severity: moderate
Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock
https://github.com/advisories/GHSA-82fw-gwwq-j7x9
fix available via `npm audit fix --force` (breaking change: installs vitest@5.0.1)

2 moderate severity vulnerabilities
```

**Client** (`npm --prefix client audit`):
```
found 0 vulnerabilities
```

**Assessment of the one finding**: `@vitest/mocker` is a transitive dependency of
`vitest`, which is a **devDependency only** — it is never installed, imported, or run as
part of the actual deployed application (`server/package.json`'s runtime `dependencies`
don't include it; it only exists under `devDependencies` → `vitest` → `@vitest/mocker`).
The advisory's exposure (path traversal / arbitrary file read via a mock redirect) only
matters in a context where someone is already running the test suite with attacker
-controlled test code — not a risk surface reachable through the running app or its API.
A fix is available but requires a breaking major-version bump (Vitest 5.x), which was not
taken in this pass to avoid destabilizing the now fully-passing 21-test regression suite
this late in the assessment. **Disposition: accepted, low actual risk, tracked below as
residual/future work** — not treated as "fixed" or ignored.

## Live before/after evidence, by domain

| Domain | Before | After |
|---|---|---|
| 1 — API | `testing/domain1-api-before-evidence.txt` | `testing/domain1-api-after-evidence.txt` |
| 2 — Database | `testing/domain2-db-before-evidence.txt` | `testing/domain2-db-after-evidence.txt` |
| 3 — Container | `testing/domain3-container-before-evidence.txt` | `testing/domain3-container-after-evidence.txt` |

Automated regression coverage: `server/test/auth.test.js` (16 tests, Domain 1) +
`server/test/db-config.test.js` (5 tests, Domain 2) = 21/21 passing as of the Domain 3
commit (`3e38f20`), confirmed by running the app end-to-end through the browser after
every domain's fix, not just the automated suite.

## Residual risk statement

Every item below was identified, deliberately not fixed in this pass, and reasoned about
— none are accidental gaps.

**From Domain 1 (API):**
- **JWTs aren't revoked server-side.** `logout` clears the browser's cookie, but the
  token itself is a stateless, cryptographically signed JWT that remains valid until its
  1-hour expiry even after logout, and — observed directly during Domain 2 testing —
  even after the underlying user record is deleted from the database (wiping the DB
  volume didn't invalidate an already-issued token, since `requireAuth` only checks the
  JWT signature, not whether the referenced user still exists). A production version of
  this app would need either short-lived tokens with refresh, or a server-side session/
  denylist store.
- **No true pagination.** `GET /api/birthdays` was fixed with a hard `LIMIT 2000` rather
  than full `limit`/`offset` pagination, to avoid breaking the client's existing
  load-everything-for-client-side-search architecture. Fine at this app's current scale;
  would need real pagination (and a client rework) well before 2,000 records.
- **Rate limiting is in-memory and per-process.** Fine for this single-instance app;
  would need a shared store (e.g. Redis) behind a load balancer with multiple instances.

**From Domain 2 (Database):**
- **No database privilege separation.** The API's own DB role can still alter/drop
  tables, not just read/write rows — see `DOMAIN2-DATABASE.md` for the full reasoning on
  why a proper fix (a second, lower-privileged runtime role) was scoped out as follow-up
  work rather than attempted in this pass.
- **No encryption at rest for PII columns.** `pgcrypto` is available but was not applied
  to `phone`/`email`/etc. — see `DOMAIN2-DATABASE.md` for the key-management reasoning.

**From Domain 3 (Container):**
- **No read-only root filesystem.** Scoped out because doing it correctly for a
  database engine (which needs `tmpfs` mounts for specific paths outside its data
  volume) risked a fragile change this session couldn't directly iterate on and verify
  live — see `DOMAIN3-CONTAINER.md`.

**Cross-cutting / newly observed while writing this document:**
- `GET /api/health` is intentionally left unauthenticated (so external monitoring/
  orchestration tooling can check it without credentials), and its response includes the
  database name (`"database": "thebirthdates"`) — a very minor information disclosure.
  Low risk (a database name is not a credential), but worth a conscious call-out rather
  than an unnoticed gap.
- The `@vitest/mocker` moderate-severity advisory documented above (dev-only exposure).

None of these are being reported as "fixed" — they're documented here specifically so
they aren't silently dropped, matching the assignment's emphasis on distinguishing
between what was verified as resolved and what remains open.

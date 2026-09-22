# Security

## About this document

This app started as a deliberately vulnerable teaching tool for CYBR 4550
("Operation Candlelight") and was then used as the subject of a hands-on application
security assessment: threat model → find real vulnerabilities → fix them → verify the
fixes → document the whole process, including what didn't work on the first try. This
file summarizes the current security posture and where to find the full evidence trail.
It's written for two audiences at once: anyone reviewing this repo as a portfolio piece,
and anyone who forks it to continue the work.

**This is a coursework / portfolio project, not a production service.** It stores
synthetic seed data only, runs on `localhost` by design, and was never exposed to the
internet at any point during the assessment.

## Assessment summary

Full methodology, data flow diagram, and STRIDE analysis: [`docs/assessment/THREAT_MODEL.md`](docs/assessment/THREAT_MODEL.md).
Consolidated scanner results and residual risk statement: [`docs/assessment/B3-VERIFICATION.md`](docs/assessment/B3-VERIFICATION.md).

| Domain | Status | Details |
|---|---|---|
| API (authentication, CORS, headers, rate limiting) | ✅ Remediated | Live before/after evidence + 16 automated regression tests |
| Database (credentials, TLS) | ✅ Remediated | Live before/after evidence + [`docs/assessment/DOMAIN2-DATABASE.md`](docs/assessment/DOMAIN2-DATABASE.md) + 5 automated regression tests |
| Container (network exposure, image pinning, resource limits) | ✅ Remediated | Live before/after evidence + [`docs/assessment/DOMAIN3-CONTAINER.md`](docs/assessment/DOMAIN3-CONTAINER.md) |

Every fix in this table was verified with a **live before/after test**, not assumed from
a code read — see `docs/assessment/testing/` for the raw evidence transcripts and the
scripts used to produce them. Two of the findings tested turned out *not* to be
exploitable (SQL injection via the search filter was tried and confirmed safe, both
before and after remediation) — reported as such rather than assumed vulnerable.

### What was fixed

- Every `/api/birthdays` route now requires authentication (previously fully open —
  anyone could read, create, edit, or delete every record with zero credentials).
- Passwords are hashed with argon2id; sessions use httpOnly, `SameSite=Strict` cookies.
- CORS is restricted to the app's own origin instead of reflecting any request origin.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) via `helmet`.
- Rate limiting on the API generally, and specifically on login (brute-force mitigation).
- Database credentials are no longer hardcoded/guessable defaults — the app now fails
  fast at startup instead of silently falling back to a weak credential.
- TLS certificate validation fixed (previously accepted any certificate, including a
  forged one, when TLS was enabled).
- The database port is bound to `127.0.0.1` only (previously reachable from the whole
  local network).
- The Postgres image is pinned to a specific digest instead of a floating tag.
- Container resource limits and `no-new-privileges` hardening added.

### Known limitations (residual risk)

Documented in full, with reasoning, in
[`docs/assessment/B3-VERIFICATION.md`](docs/assessment/B3-VERIFICATION.md). Summary:

- Session tokens (JWTs) aren't revoked server-side — logout clears the cookie, but an
  already-issued token stays cryptographically valid until it expires (1 hour).
- No database-level privilege separation between schema-init and runtime access.
- No encryption at rest for the PII columns.
- No read-only container filesystem.
- One moderate-severity advisory in a **dev-only** dependency (`@vitest/mocker`, part of
  the test runner) — never shipped in the running app.

None of these are oversights — each was evaluated and consciously scoped out of this
pass, with the reasoning written down rather than silently dropped.

## Reporting a vulnerability

This is an academic project rather than an actively maintained service, so there's no
formal disclosure program. If you're reviewing this repo (as a classmate, instructor, or
hiring manager) and spot something beyond what's documented above, opening a GitHub issue
on this fork is the right way to flag it.

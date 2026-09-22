# Baseline — Pre-Assessment State

**Captured:** 2026-09-22
**Branch:** security-hardening-appsec
**Track:** B — Application Security

## Purpose

This file records the application's state *before* any threat modeling, remediation, or code
changes were made, per the assignment's Step 0 requirement ("capture your before state"). All
before/after evidence pairs produced later in this assessment reference this baseline.

## Environment

- App cloned from fork, dependencies installed via `npm run install:all`.
- `server/.env` created from `server/.env.example` (unmodified defaults — see
  `docs/assessment/config-snapshots/server.env.example.baseline`).
- Database container started via `docker compose up -d` (unmodified `docker-compose.yml` — see
  `docs/assessment/config-snapshots/docker-compose.yml.baseline`).
- Database seeded with synthetic data only via `npm run seed` (`node src/seed.js`) — 8 sample
  birthday records inserted (fictional names, e.g. "Ada Lovelace," used as placeholder seed data
  by the project's own seed script). No real personal data was used at any point.
- App started via `npm run dev` — API on `http://localhost:4000`, client on `http://localhost:5173`.

## Confirmed working

- Client loads at `http://localhost:5173` and displays the seeded data correctly (8 saved
  birthdays, "celebrating today" / "this month" counts, etc.) — see
  `docs/assessment/screenshots/baseline-app-running.png`.
- API responded and served the schema/data (`[db] schema ready on "thebirthdates"`,
  `[api] listening on http://localhost:4000`).

## `docker compose ps` output (unmodified `docker-compose.yml`)

```
NAME               IMAGE                COMMAND                  SERVICE    CREATED          STATUS                    PORTS
thebirthdates-db   postgres:16-alpine   "docker-entrypoint.s…"   postgres   10 minutes ago   Up 10 minutes (healthy)   0.0.0.0:5544->5432/tcp, [::]:5544->5432/tcp
```

Note the container publishes port 5544 to `0.0.0.0` (all interfaces) as well as `[::]` (all IPv6
interfaces), not only to `127.0.0.1` — this is part of what the threat model and container
hardening pass (Domain 3) will need to evaluate.

## Unmodified configuration snapshotted for reference

Copied byte-for-byte from the unmodified `main` branch into `docs/assessment/config-snapshots/`
before any edits:

- `docker-compose.yml.baseline`
- `server.env.example.baseline`
- `db.js.baseline`
- `routes.js.baseline`
- `index.js.baseline`

## Scope note

All testing and changes described in this assessment occurred exclusively against this local
fork, running on localhost, bound to 127.0.0.1/0.0.0.0 on this machine only, with synthetic seed
data. No real personal information was ever entered into the application. The instance was never
exposed to the internet.

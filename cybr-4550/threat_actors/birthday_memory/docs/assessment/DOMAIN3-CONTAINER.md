# Domain 3 (Container) — Remediation Notes

## Findings (from the roadmap in THREAT_MODEL.md)

1. **Database port exposed to the whole network**, not just this machine.
   `docker-compose.yml`'s `ports: - "5544:5432"` has no bind address, which Docker
   defaults to `0.0.0.0` — every network interface on the host, not only loopback.
2. **Floating image tag**. `postgres:16-alpine` is a mutable name someone else (Docker
   Hub / the Postgres image maintainers) controls — it could point at different image
   content tomorrow than it does today, with no signal to this project.
3. **No resource limits**. A single container could consume unbounded host CPU/memory.

## Test first, report what you proved

Before changing anything, `server/scripts/domain3-port-exposure-test.mjs` connected to
the database using this machine's own LAN-facing IP address (`10.0.0.171`, not
`localhost`/`127.0.0.1`) — no VPN, no second physical device needed, since a `0.0.0.0`
bind listens on every interface including the one facing the LAN. It succeeded and read
the full row count. See `docs/assessment/testing/domain3-container-before-evidence.txt`.
This proves the finding is real: anyone else on the same network segment as this
computer — not just processes running on it — could reach the database port directly.
(This is a distinct, additional layer on top of Domain 2's credential fix: even correct,
non-guessable credentials shouldn't be reachable from the whole LAN by default.)

## What was fixed

- **Port binding**: changed to `"127.0.0.1:5544:5432"`, restricting the published port
  to this machine only — matching how it's actually meant to be used (the API, running
  on the same host, is the only intended client).
- **Image pinning**: pinned to the exact digest that was running during this assessment
  (`postgres:16-alpine@sha256:721873c3...`), captured via
  `docker inspect thebirthdates-db --format "{{.Image}}"`. The human-readable tag is kept
  alongside the digest; the digest is what Docker actually pulls and runs.
- **Resource limits**: added `deploy.resources.limits` (512MB memory, 1 CPU) — generous
  headroom for this small dev database, but no longer unbounded.
- **`no-new-privileges`**: added via `security_opt`. Cheap, safe, no functional downside
  for this workload — prevents any process in the container from gaining additional
  privileges even if something inside it were compromised.

## Already secure by default (not a "fix," just confirmed)

The official `postgres:16-alpine` image already runs its `postgres` process as a
non-root user (`postgres`, UID 999) out of the box — this was verified, not assumed, by
checking the image's own Dockerfile/behavior, and required no change here.

## Scoped out (documented, not implemented) — and why

- **Read-only root filesystem** (`read_only: true`). A database engine legitimately
  needs to write outside its data volume — temp files, its PID file, a Unix domain
  socket directory — so doing this properly requires adding `tmpfs` mounts for those
  specific paths (and getting the exact set of paths right for this Postgres image).
  Not implemented here because it's a nontrivial, easy-to-get-subtly-wrong change that
  could break database startup in a way that's hard to debug without direct access to
  run and iterate on the container locally (this session worked through the person
  running the commands, not a live Docker connection) — a real fix, but a follow-up
  worth doing carefully rather than rushing into this pass. Recommended as forward-
  looking work in the board report.

## Verification

`docs/assessment/testing/domain3-container-before-evidence.txt` — proves the DB port
was reachable from this machine's LAN-facing address (before the fix).
`docs/assessment/testing/domain3-container-after-evidence.txt` — proves it no longer is
(after the fix), while confirming the app itself still works via `localhost`.

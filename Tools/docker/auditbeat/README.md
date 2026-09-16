# Auditbeat lab stack

Runs [Auditbeat](https://www.elastic.co/beats/auditbeat) against the
`./evidence` directory so students can watch file-integrity and system events
generated while they work an evidence file. Elasticsearch and Kibana are an
optional add-on for viewing those events in a browser.

## Files

- `docker-compose.yml` — Auditbeat only. Can run standalone.
- `auditbeat.yml` — Auditbeat config. Watches `/evidence` (`file_integrity`)
  and host/process/user activity (`system`), and ships events to
  Elasticsearch.
- `docker-compose.elastic.yml` — optional Elasticsearch + Kibana services.
- `evidence/` — bind-mounted into the container at `/evidence`; drop sample
  files here to generate events.
- `data/`, `esdata/` — per-container runtime state (Auditbeat's registry,
  Elasticsearch's indices). Git-ignored; safe to delete to reset the stack.

## Running with Elasticsearch + Kibana (recommended)

From this directory:

```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml up -d
```

This starts all three containers on a shared `elastic` network so Auditbeat
can reach Elasticsearch and Kibana by service name. Wait ~30-60s for
Elasticsearch to report healthy on first start, then:

- **Kibana (dashboards):** http://localhost:5601 → menu (☰) → **Dashboards**.
  Auditbeat auto-loads its **"[Auditbeat] System"** and
  **"[Auditbeat] File Integrity"** dashboards on first run
  (`setup.dashboards.enabled: true` in `auditbeat.yml`), so they appear
  without any manual setup.
- **Discover (raw events / live logs):** Kibana → **Discover**, index
  pattern `auditbeat-*`. This is the easiest place to tail individual events
  as they arrive, filterable by module (`file_integrity`, `system.process`,
  `system.user`, etc.).
- **Elasticsearch API:** http://localhost:9200 (e.g.
  `curl http://localhost:9200/_cat/indices?v` to confirm data is indexing).

No login is required — security is disabled for this local, single-node
teaching setup (see the header comment in `docker-compose.elastic.yml`).

To stop and remove containers (keeping indexed data in `./esdata`):

```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml down
```

## Running Auditbeat only (no browser dashboard)

```bash
docker compose up -d
```

Auditbeat still tries to ship events to `elasticsearch:9200`; since nothing
is listening, it will just retry in the background (visible via
`docker compose logs -f auditbeat`) until you also start the elastic stack.
For quick, dependency-free debugging, edit `auditbeat.yml` and swap the
`output.elasticsearch` block for the commented-out `output.console` block at
the bottom of the file.

## Troubleshooting

- **Kibana shows no data / dashboards are empty:** confirm events are
  indexing with `curl http://localhost:9200/_cat/indices?v` — you should see
  an `auditbeat-*` index with a growing `docs.count`. If it's missing,
  check `docker compose logs auditbeat` for connection errors.
- **Elasticsearch exits immediately / fails healthcheck:** it usually needs
  more memory than Docker Desktop is allotted. Increase Docker Desktop's
  memory limit (Settings → Resources) to at least 4 GB, or lower
  `ES_JAVA_OPTS` in `docker-compose.elastic.yml`.
- **Reset everything:** `docker compose -f docker-compose.yml -f docker-compose.elastic.yml down` then delete the contents of `./data` and `./esdata`.

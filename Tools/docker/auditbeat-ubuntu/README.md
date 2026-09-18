# Auditbeat lab stack — Ubuntu / native Linux

Same lab as [`../auditbeat`](../auditbeat), but targeted at **Docker Engine on
a native Ubuntu host** instead of Docker Desktop on macOS.

Runs [Auditbeat](https://www.elastic.co/beats/auditbeat) against the
`./evidence` directory so students can watch file-integrity, kernel-audit, and
system events generated while they work an evidence file. Elasticsearch and
Kibana are an optional add-on for viewing those events in a browser.

## What's different from the macOS version

| | macOS (`../auditbeat`) | Ubuntu (this directory) |
|---|---|---|
| `auditd` module | Disabled — Docker Desktop's linuxkit kernel has no `CONFIG_AUDIT` | **Enabled**, with syscall + watch rules |
| `system` datasets | `host`, `process`, `user` | adds `login` (wtmp/btmp) and `package` (dpkg); `socket` is opt-in |
| Capabilities | none | `AUDIT_CONTROL`, `AUDIT_READ`, `NET_ADMIN`, `SYS_PTRACE`, `DAC_READ_SEARCH` |
| PID namespace | container | `pid: host` (audit netlink is not namespaced) |
| Host mounts | config + data + evidence | adds `/proc`, `/etc/passwd`, `/etc/group`, `/var/log`, `/var/lib/dpkg` |
| AppArmor | n/a | `apparmor=unconfined` for the Auditbeat container only |
| Host prep | none | `sudo ./host-setup.sh` (auditd conflict, `vm.max_map_count`, ownership) |
| Published ports | `0.0.0.0` | bound to `127.0.0.1` (Docker on Linux bypasses `ufw`) |

## Files

- `host-setup.sh` — one-time root-level host prep. **Run this first.**
- `host-reset.sh` — undoes everything `host-setup.sh` changed (audit rules,
  masked `auditd`, the `vm.max_map_count` override, runtime data) so you can
  start over from scratch. Does not touch Docker itself.
- `docker-compose.yml` — Auditbeat only. Can run standalone.
- `auditbeat.yml` — Auditbeat config. Kernel audit rules (`auditd`), `/evidence`
  watching (`file_integrity`), and host/process/user/login/package activity
  (`system`); ships events to Elasticsearch.
- `docker-compose.elastic.yml` — optional Elasticsearch + Kibana services.
- `evidence/` — bind-mounted into the container at `/evidence`; drop sample
  files here to generate events.
- `data/`, `esdata/` — per-container runtime state (Auditbeat's registry,
  Elasticsearch's indices). Git-ignored; safe to delete to reset the stack.

## Prerequisites

Docker Engine + the Compose plugin from Docker's own apt repo (Ubuntu's
`docker.io` package ships an older Compose):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Optional: run docker without sudo (log out and back in afterwards)
sudo usermod -aG docker "$USER"
```

## Host setup (run once)

```bash
sudo ./host-setup.sh
```

This checks for `CONFIG_AUDIT`, stops and masks the host's `auditd` if it is
running, raises `vm.max_map_count` to 262144 for Elasticsearch, creates the
runtime directories, and fixes bind-mount ownership.

### Starting over from scratch

If you (or a previous attempt at this lab) already changed host state and
something is now broken or half-configured, reset it first:

```bash
sudo ./host-reset.sh
docker compose -f docker-compose.yml -f docker-compose.elastic.yml down -v   # if containers exist
sudo ./host-setup.sh
```

`host-reset.sh` clears any kernel audit rules, unmasks and restarts the
host's own `auditd` if it has one, removes the persisted `vm.max_map_count`
sysctl override, and wipes+recreates `data/`, `esdata/`, `evidence/` with
correct ownership. It never runs `docker` itself — run the `docker compose
... down -v` command above first if containers/volumes from a previous
attempt still exist. It is safe to run even if `host-setup.sh` was never run
or only partly succeeded; every step is a no-op when there is nothing to
undo.

> **Why stop the host's `auditd`?** The kernel only lets one process hold the
> *unicast* audit netlink socket. If `auditd` already owns it, Auditbeat logs
> `failed to set audit PID` and the module never starts. If you must leave the
> host's `auditd` running, delete the `audit_rules` block from `auditbeat.yml`
> and add `socket_type: multicast` instead — Auditbeat then passively reads a
> copy of the events while `auditd` keeps managing the rules.

## Running with Elasticsearch + Kibana (recommended)

From this directory:

```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml up -d
```

This starts all three containers on a shared `elastic` network so Auditbeat
can reach Elasticsearch and Kibana by service name. Wait ~30-60s for
Elasticsearch to report healthy on first start, then:

- **Kibana (dashboards):** http://localhost:5601 → menu (☰) → **Dashboards**.
  Auditbeat auto-loads its **"[Auditbeat] System"**, **"[Auditbeat] File
  Integrity"** and **"[Auditbeat] Auditd"** dashboards on first run
  (`setup.dashboards.enabled: true` in `auditbeat.yml`), so they appear
  without any manual setup. The Auditd dashboard is the one that has no data
  on macOS.
- **Discover (raw events / live logs):** Kibana → **Discover**, index
  pattern `auditbeat-*`. Filter by `auditd.data.key` to isolate the rules
  defined in `auditbeat.yml`: `evidence_access`, `exec`, `priv_change`,
  `sudoers`, `identity`, `log_tamper`, `modules`.
- **Elasticsearch API:** http://localhost:9200 (e.g.
  `curl http://localhost:9200/_cat/indices?v` to confirm data is indexing).

No login is required — security is disabled for this local, single-node
teaching setup (see the header comment in `docker-compose.elastic.yml`).

To stop and remove containers (keeping indexed data in `./esdata`):

```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml down
```

Auditbeat removes the audit rules it installed when it shuts down cleanly.
Verify with `sudo auditctl -l` (should print `No rules`).

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

## Generating events to look at

```bash
# file_integrity + the evidence_access audit rule
echo "sample artifact" > evidence/note.txt
sha256sum evidence/note.txt
rm evidence/note.txt

# the exec audit rule
/bin/ls /tmp

# the priv_change / sudoers rules
sudo -n true
```

## Verifying the full deployment (end-to-end check)
Run this whole sequence after a fresh checkout, or any time you want to
confirm `host-setup.sh`, the containers, and `host-reset.sh` all still work
together. All commands run from this directory on the Ubuntu host.
### 1. Check prerequisites
```bash
docker --version
docker compose version
```
If either is missing, install per the **Prerequisites** section above.
### 2. Run setup and confirm host state
```bash
sudo ./host-setup.sh
```
Expect all 5 steps to print `OK` (step 1 may print a `WARNING` if the kernel
lacks `CONFIG_AUDIT`, which is unlikely on stock Ubuntu). Confirm the changes:
```bash
sudo auditctl -s | grep enabled          # audit subsystem active
sysctl vm.max_map_count                   # should print 262144
cat /etc/sysctl.d/99-auditbeat-lab.conf   # persisted override
ls -ld data evidence esdata               # data/evidence owned by you, esdata by 1000:0
```
### 3. Launch the containers and confirm health
```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml up -d
docker compose ps
```
All three services should reach `running`/`healthy` within ~30-60s (first
start is slower while Elasticsearch initializes). Then:
```bash
curl -sf http://localhost:9200/_cluster/health?pretty
curl -sf http://localhost:5601/api/status | grep -o '"level":"[^"]*"'
sudo auditctl -l                          # lists the rules from auditbeat.yml
```
### 4. Generate events and confirm they are indexed
```bash
echo "sample artifact" > evidence/note.txt
rm evidence/note.txt
/bin/ls /tmp
sleep 5
curl -s 'http://localhost:9200/_cat/indices?v' | grep auditbeat
```
An `auditbeat-*` index with a non-zero, growing `docs.count` confirms events
are flowing end-to-end. Open http://localhost:5601 → **Dashboards** to
visually confirm the **System**, **File Integrity**, and **Auditd**
dashboards are populated.
### 5. Tear down and verify the reset script
```bash
docker compose -f docker-compose.yml -f docker-compose.elastic.yml down -v
sudo ./host-reset.sh
```
Confirm host state was actually reverted:
```bash
sudo auditctl -l                                    # -> "No rules"
test -f /etc/sysctl.d/99-auditbeat-lab.conf && echo "still present!" || echo "removed OK"
ls data evidence esdata                             # empty except .gitkeep
systemctl is-masked auditd 2>/dev/null || echo "not masked (or no auditd unit)"
```
### 6. Confirm a clean re-run succeeds
```bash
sudo ./host-setup.sh
docker compose -f docker-compose.yml -f docker-compose.elastic.yml up -d
docker compose ps
```
This closes the loop — setup → running stack → reset → clean state → setup
again succeeds — proving `host-reset.sh` never leaves anything behind that
blocks a fresh `host-setup.sh` run.
## Troubleshooting

- **`auditd` module fails with "failed to set audit PID" or
  "address already in use":** something else owns the audit socket. Check with
  `sudo systemctl status auditd` and `sudo auditctl -s` (look at the `pid`
  field). Re-run `sudo ./host-setup.sh`.
- **`auditd` module fails with "permission denied" / "operation not
  permitted" despite the capabilities:** AppArmor or a hardened kernel is
  blocking audit netlink. Confirm `security_opt: apparmor=unconfined` is still
  present, and check `sudo dmesg | grep -i apparmor` for denials.
- **No audit events at all, but no errors:** the kernel audit backlog may be
  disabled. `sudo auditctl -s` should show `enabled 1`. If it shows `enabled
  0`, boot with `audit=1` on the kernel command line.
- **Elasticsearch exits with "max virtual memory areas vm.max_map_count is too
  low":** `sudo sysctl -w vm.max_map_count=262144`, or re-run
  `sudo ./host-setup.sh` which also persists it.
- **Elasticsearch exits with `AccessDeniedException: /usr/share/elasticsearch/data/...`:**
  the bind mount is owned by the wrong user. `sudo chown -R 1000:0 ./esdata`.
- **Elasticsearch is OOM-killed:** lower `ES_JAVA_OPTS` in
  `docker-compose.elastic.yml` (e.g. `-Xms512m -Xmx512m`) on hosts with less
  than 4 GB RAM.
- **Kibana shows no data / dashboards are empty:** confirm events are
  indexing with `curl http://localhost:9200/_cat/indices?v` — you should see
  an `auditbeat-*` index with a growing `docs.count`. If it's missing,
  check `docker compose logs auditbeat` for connection errors.
- **`socket` dataset fails to load kprobes:** confirm tracefs is mounted
  (`mount | grep tracefs`) and writable inside the container. If not, leave the
  dataset commented out — the rest of the lab does not depend on it.
- **Reset everything:** `docker compose -f docker-compose.yml -f docker-compose.elastic.yml down`
  then `sudo rm -rf ./data/* ./esdata/*` and re-run `sudo ./host-setup.sh`.

#!/usr/bin/env bash
#
# Undo everything host-setup.sh (or a previous, possibly different, attempt
# at this lab) may have changed on an Ubuntu host, so you can start over from
# a clean slate. This script does NOT touch Docker/containers/images — it
# only reverses host-level state: kernel audit rules, the auditd service,
# the persisted sysctl override, and this lab's runtime directories.
#
# Safe to run even if host-setup.sh was never run, or only partially
# succeeded — every step is a no-op if there is nothing to undo.
#
#   sudo ./host-reset.sh
#
set -uo pipefail
# Note: intentionally NOT using `set -e`. A reset script must keep going and
# report problems rather than abort halfway through, leaving the host in a
# worse in-between state than when it started.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILURES=0

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must run as root: sudo $0" >&2
  exit 1
fi

step() { echo "==> $*"; }
ok()   { echo "    OK: $*"; }
warn() { echo "    WARNING: $*" >&2; FAILURES=$((FAILURES + 1)); }

step "1/6 Removing kernel audit rules installed by Auditbeat"
if command -v auditctl >/dev/null 2>&1; then
  RULE_COUNT="$(auditctl -l 2>/dev/null | grep -cv '^No rules$')"
  if [[ "${RULE_COUNT}" -gt 0 ]]; then
    if auditctl -D >/dev/null 2>&1; then
      ok "cleared ${RULE_COUNT} rule(s)"
    else
      warn "auditctl -D failed; audit subsystem may not be enabled"
    fi
  else
    ok "no rules present"
  fi
else
  ok "auditctl not installed, nothing to clear"
fi

step "2/6 Restoring the host's own auditd service"
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-enabled --quiet auditd 2>/dev/null || systemctl list-unit-files 2>/dev/null | grep -q '^auditd\.service'; then
    if [[ "$(systemctl is-masked auditd 2>/dev/null)" == "masked" ]]; then
      systemctl unmask auditd && ok "unmasked auditd" || warn "failed to unmask auditd"
    else
      ok "auditd was not masked"
    fi
    # Only restart it if it isn't already running under its own steam.
    if ! systemctl is-active --quiet auditd 2>/dev/null; then
      systemctl start auditd 2>/dev/null && ok "started auditd" \
        || warn "auditd did not start; leave it stopped if you don't need it"
    else
      ok "auditd already running"
    fi
  else
    ok "no auditd unit on this host, nothing to restore"
  fi
else
  ok "systemctl not available, skipping"
fi

step "3/6 Reverting the vm.max_map_count sysctl override"
SYSCTL_FILE="/etc/sysctl.d/99-auditbeat-lab.conf"
if [[ -f "${SYSCTL_FILE}" ]]; then
  rm -f "${SYSCTL_FILE}"
  # Reload the remaining sysctl.d files so the running value reflects
  # whatever the rest of the system wants, rather than leaving 262144 live.
  sysctl --system >/dev/null 2>&1
  ok "removed ${SYSCTL_FILE} and reloaded sysctl (current: $(sysctl -n vm.max_map_count 2>/dev/null))"
else
  ok "no override file present"
fi

step "4/6 Deleting this lab's runtime data"
for dir in data esdata evidence; do
  target="${SCRIPT_DIR}/${dir}"
  if [[ -d "${target}" ]]; then
    rm -rf "${target:?}"/*
    ok "cleared ${dir}/"
  fi
done

step "5/6 Recreating empty runtime directories"
mkdir -p "${SCRIPT_DIR}/data" "${SCRIPT_DIR}/evidence" "${SCRIPT_DIR}/esdata"
touch "${SCRIPT_DIR}/evidence/.gitkeep" "${SCRIPT_DIR}/esdata/.gitkeep"
LAB_USER="${SUDO_USER:-root}"
# evidence/data: the student's own shell needs to write here.
chown -R "${LAB_USER}:${LAB_USER}" "${SCRIPT_DIR}/evidence" "${SCRIPT_DIR}/data"
# esdata: must stay owned by uid 1000 (the elasticsearch image's container user).
chown -R 1000:0 "${SCRIPT_DIR}/esdata"
ok "recreated data/, evidence/ (owned by ${LAB_USER}) and esdata/ (owned by 1000:0)"

step "6/6 Reminder: this script does not touch Docker"
cat <<'EOF'
    If containers/images/volumes from a previous attempt are still around,
    remove them yourself, e.g.:
      docker compose -f docker-compose.yml -f docker-compose.elastic.yml down -v
      docker system prune -f          # optional, affects ALL local images/containers
EOF

echo
if [[ "${FAILURES}" -eq 0 ]]; then
  echo "Host reset complete with no warnings. Re-run: sudo ./host-setup.sh"
else
  echo "Host reset complete with ${FAILURES} warning(s) above — review before continuing."
fi

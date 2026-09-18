#!/usr/bin/env bash
#
# One-time host preparation for the Ubuntu Auditbeat lab.
#
# Docker Desktop on macOS hid all of this inside its VM. On a native Ubuntu
# host the kernel and filesystem are yours, so a few things have to be set up
# before `docker compose up` will work. Re-running this is safe.
#
#   sudo ./host-setup.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must run as root: sudo $0" >&2
  exit 1
fi

# The unprivileged user who invoked sudo; used to keep ./data and ./evidence
# writable from the student's normal shell.
LAB_USER="${SUDO_USER:-root}"

echo "==> 1/5 Checking kernel audit support"
if ! grep -qs 'CONFIG_AUDIT=y' "/boot/config-$(uname -r)"; then
  echo "    WARNING: CONFIG_AUDIT=y not found in /boot/config-$(uname -r)."
  echo "    The auditd module will not start. Comment it out of auditbeat.yml"
  echo "    to run the file_integrity/system modules only."
else
  echo "    OK: kernel built with CONFIG_AUDIT"
fi

echo "==> 2/5 Releasing the audit netlink socket from the host's auditd"
# Only one process can own the unicast audit socket. Ubuntu Server images
# often ship auditd; Ubuntu Desktop usually does not.
if systemctl is-active --quiet auditd 2>/dev/null; then
  echo "    Stopping and masking auditd so Auditbeat can own the socket."
  echo "    Undo later with: sudo systemctl unmask auditd && sudo systemctl start auditd"
  systemctl stop auditd
  systemctl mask auditd
else
  echo "    OK: host auditd is not running"
fi
# Clear any audit rules a previous run left behind; Auditbeat installs its own.
command -v auditctl >/dev/null 2>&1 && auditctl -D >/dev/null 2>&1 || true

echo "==> 3/5 Raising vm.max_map_count for Elasticsearch"
CURRENT_MMC="$(sysctl -n vm.max_map_count)"
if [[ "${CURRENT_MMC}" -lt 262144 ]]; then
  sysctl -w vm.max_map_count=262144
  # Persist across reboots.
  echo 'vm.max_map_count=262144' > /etc/sysctl.d/99-auditbeat-lab.conf
  echo "    Raised from ${CURRENT_MMC} to 262144 (persisted)"
else
  echo "    OK: already ${CURRENT_MMC}"
fi

echo "==> 4/5 Creating runtime directories"
mkdir -p "${SCRIPT_DIR}/data" "${SCRIPT_DIR}/evidence" "${SCRIPT_DIR}/esdata"
touch "${SCRIPT_DIR}/evidence/.gitkeep" "${SCRIPT_DIR}/esdata/.gitkeep"

echo "==> 5/5 Fixing bind-mount ownership"
# Elasticsearch's container runs as uid 1000, gid 0.
chown -R 1000:0 "${SCRIPT_DIR}/esdata"
# Auditbeat's container runs as root, but students need to drop files into
# ./evidence from their own shell.
chown -R "${LAB_USER}:${LAB_USER}" "${SCRIPT_DIR}/evidence"
echo "    OK"

echo
echo "Host ready. Start the lab with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.elastic.yml up -d"

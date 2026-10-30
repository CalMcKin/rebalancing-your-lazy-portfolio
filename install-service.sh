#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="portfolio-rebalancer"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="$(id -un)"
PYTHON3="$(command -v python3 || true)"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this installer as your regular user; it will use sudo for system changes." >&2
  exit 1
fi

if [[ ! -d /run/systemd/system ]] || ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd is not available on this host." >&2
  exit 1
fi

if [[ -z "$PYTHON3" ]]; then
  echo "python3 is required but was not found in PATH." >&2
  exit 1
fi

if [[ "$REPO_DIR" =~ [[:space:]%\\] ]]; then
  echo "The repository path cannot contain whitespace, percent signs, or backslashes." >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required to install and enable the system service." >&2
  exit 1
fi

sudo -v

sudo tee "$UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=Portfolio Rebalancer website
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${REPO_DIR}
ExecStart=${PYTHON3} -m http.server 8000 --bind 0.0.0.0 --directory ${REPO_DIR}
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

if ! sudo systemctl restart "$SERVICE_NAME"; then
  echo "The service failed to start. Recent logs:" >&2
  sudo journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2
  exit 1
fi

if ! sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "The service is not active. Recent logs:" >&2
  sudo journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2
  exit 1
fi

echo "Portfolio Rebalancer is installed and running at boot."
echo "Open http://<host-address>:8000/"
echo "View logs with: sudo journalctl -u ${SERVICE_NAME} -f"

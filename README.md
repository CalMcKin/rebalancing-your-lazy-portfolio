# Portfolio Rebalancer

A lightweight, browser-based tool for calculating portfolio trades. Add your own asset types, enter each target allocation and current value, and see the current allocation, suggested buys or sells, and resulting values.

## Run locally

From the repository directory, start a local static web server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This avoids browsers or editor previews that block pages opened directly from a local file. No installation, build step, or external service is required.

## Install as a system service

On a Linux host running systemd, install the service from the repository directory:

```sh
chmod +x install-service.sh
./install-service.sh
```

The installer uses `sudo` to create and enable `portfolio-rebalancer.service`. The service runs as the user who launched the installer, serves this repository on port 8000, starts at boot, and restarts if the server exits. If a manually started server is already using port 8000, stop it before installing.

Check service status and follow its logs:

```sh
sudo systemctl status portfolio-rebalancer
sudo journalctl -u portfolio-rebalancer -f
```

To stop the service temporarily, run `sudo systemctl stop portfolio-rebalancer`. To remove it and disable startup:

```sh
sudo systemctl disable --now portfolio-rebalancer
sudo rm /etc/systemd/system/portfolio-rebalancer.service
sudo systemctl daemon-reload
```

The server listens on all network interfaces. Use it only on a trusted network; the built-in Python server has no authentication or HTTPS and should not be exposed directly to the public internet.

## Use

1. Use the 401(k), Roth IRA, and Traditional Brokerage tabs to manage each account independently. Each starts with Total Stock (70%), Total Bond (10%), and Total International Stock (20%).
2. With positive cash, leave assets unchecked to prevent sales; check an asset to allow selling it. Negative cash is treated as a withdrawal and automatically produces sells only, regardless of checkboxes.
3. Enter a positive cash contribution or a negative withdrawal, or choose **Calculate to target** to find the smallest cash contribution that reaches the account's target allocations without selling.
4. Use the Summary tab to see combined current values and allocations across all three accounts, and enter overall target percentages by asset type. The summary does not calculate trades.
5. Account values, targets, sale settings, cash amounts, and summary targets save automatically in this browser and are restored when you reopen the page on the same site.

Target percentages must add up to 100% before trades are calculated. **Calculate to target** finds the minimum positive contribution needed to reach exact target percentages without selling unchecked assets; checked assets may be sold to reduce the required contribution. Withdrawals never generate buys, so final percentages may differ from targets when reaching them would require a purchase. The calculator runs locally in the browser and does not provide investment advice.

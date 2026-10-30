# Portfolio Rebalancer

A lightweight, browser-based tool for calculating portfolio trades. Add your own asset types, enter each target allocation and current value, and see the current allocation, suggested buys or sells, and resulting values.

## Run locally

From the repository directory, start a local static web server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This avoids browsers or editor previews that block pages opened directly from a local file. No installation, build step, or external service is required.

## Use

1. Use the 401(k), Roth IRA, and Traditional Brokerage tabs to manage each account independently. Each starts with Total Stock (70%), Total Bond (10%), and Total International Stock (20%).
2. With positive cash, leave assets unchecked to prevent sales; check an asset to allow selling it. Negative cash is treated as a withdrawal and automatically produces sells only, regardless of checkboxes.
3. Enter a positive cash contribution or a negative withdrawal, or choose **Calculate to target** to find the smallest cash contribution that reaches the account's target allocations without selling.
4. Use the Summary tab to see combined current values and allocations across all three accounts, and enter overall target percentages by asset type. The summary does not calculate trades.
5. Account values, targets, sale settings, cash amounts, and summary targets save automatically in this browser and are restored when you reopen the page on the same site.

Target percentages must add up to 100% before trades are calculated. **Calculate to target** finds the minimum positive contribution needed to reach exact target percentages without selling unchecked assets; checked assets may be sold to reduce the required contribution. Withdrawals never generate buys, so final percentages may differ from targets when reaching them would require a purchase. The calculator runs locally in the browser and does not provide investment advice.

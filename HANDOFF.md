# Agent handoff

## Project

This is a static, browser-only portfolio rebalancer. It has no build step or external dependencies. Run it locally with `python3 -m http.server 8000` from this directory and open `http://localhost:8000`.

## Files

- `index.html` contains the account tabs, account calculator, and combined summary.
- `app.js` owns account data, trade calculations, chart rendering, and browser persistence.
- `styles.css` contains the responsive layout, allocation rings, and input styling.
- `README.md` documents how to run and use the app.

## Behavior to preserve

- The 401(k), Roth IRA, and Traditional Brokerage each have independent holdings, targets, sale permissions, and cash contributions. New accounts start with Total Stock (70%), Total Bond (10%), and Total International Stock (20%).
- The Summary tab aggregates current values by asset name across accounts. Its overall targets are independent of account targets, and it does not calculate trades.
- The account chart shows target, current, and after-trade percentages as three concentric rings; the legend reports all three values.
- Account data, summary targets, and the selected tab save to `localStorage` under `portfolio-rebalancer-state-v1`. Keep saved-state loading tolerant of missing or malformed data and report storage errors visibly.
- Positive contributions buy only unless an asset's sale checkbox is enabled. Withdrawals generate sells only.
- Reset restores only the active account to its initial assets and zero contribution.

## Validation

There is no configured test runner. For UI changes, run the app in a browser and verify account switching, summary aggregation, calculations, and persistence across reloads. The browser's local storage is origin-specific, so reopening the app under a different hostname or protocol uses a different saved state.

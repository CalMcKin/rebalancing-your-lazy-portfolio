"use strict";

const palette = ["#2baef2", "#6055d9", "#00cf79", "#f0a33b", "#e36c9a", "#42c5b7", "#ad76e8", "#d4c43b"];
const initialAssets = [
  { name: "Total Stock", target: 70, current: 0, allowSale: false },
  { name: "Total Bond", target: 10, current: 0, allowSale: false },
  { name: "Total International Stock", target: 20, current: 0, allowSale: false },
];
const accounts = [
  { id: "401k", name: "401(k)", assets: initialAssets.map((asset) => ({ ...asset })), contribution: 0 },
  { id: "roth", name: "Roth IRA", assets: initialAssets.map((asset) => ({ ...asset })), contribution: 0 },
  { id: "brokerage", name: "Traditional Brokerage", assets: initialAssets.map((asset) => ({ ...asset })), contribution: 0 },
];
let activeAccount = accounts[0];
let assets = activeAccount.assets;
const summaryTargets = new Map(initialAssets.map((asset) => [asset.name, asset.target]));
const storageKey = "portfolio-rebalancer-state-v1";
let hasCompletedInitialRender = false;

const rowsElement = document.querySelector("#asset-rows");
const contributionInput = document.querySelector("#contribution");
const contributionSlider = document.querySelector("#contribution-slider");
const allocationTotalElement = document.querySelector("#allocation-total");
const messageElement = document.querySelector("#table-message");
const accountView = document.querySelector("#account-view");
const summaryView = document.querySelector("#summary-view");
const summaryRowsElement = document.querySelector("#summary-rows");
const storageStatusElement = document.querySelector("#storage-status");

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function setStorageStatus(message, isError = false) {
  storageStatusElement.textContent = message;
  storageStatusElement.classList.toggle("is-error", isError);
}

function isValidSavedAccount(account) {
  return account
    && typeof account.id === "string"
    && Array.isArray(account.assets)
    && Number.isSafeInteger(account.contribution)
    && account.assets.every((asset) => asset
      && typeof asset.name === "string"
      && Number.isFinite(asset.target)
      && Number.isFinite(asset.current)
      && asset.current >= 0
      && typeof asset.allowSale === "boolean");
}

function loadPortfolioState() {
  let serialized;
  try {
    serialized = localStorage.getItem(storageKey);
  } catch (error) {
    setStorageStatus(`Could not read saved portfolio data: ${error.message}`, true);
    return null;
  }
  if (serialized === null) return null;

  let saved;
  try {
    saved = JSON.parse(serialized);
  } catch (error) {
    setStorageStatus(`Saved portfolio data could not be read: ${error.message}`, true);
    return null;
  }

  const valid = saved
    && saved.version === 1
    && Array.isArray(saved.accounts)
    && saved.accounts.length === accounts.length
    && saved.accounts.every(isValidSavedAccount)
    && accounts.every((account) => saved.accounts.some((savedAccount) => savedAccount.id === account.id))
    && saved.summaryTargets
    && typeof saved.summaryTargets === "object"
    && !Array.isArray(saved.summaryTargets)
    && Object.values(saved.summaryTargets).every(Number.isFinite)
    && typeof saved.activeAccountId === "string"
    && accounts.some((account) => account.id === saved.activeAccountId)
    && ["401k", "roth", "brokerage", "summary"].includes(saved.activeTab);
  if (!valid) {
    setStorageStatus("Saved portfolio data has an invalid format. Your current entries were not restored.", true);
    return null;
  }
  return saved;
}

const savedPortfolio = loadPortfolioState();
if (savedPortfolio) {
  savedPortfolio.accounts.forEach((savedAccount) => {
    const account = accounts.find((item) => item.id === savedAccount.id);
    account.assets = savedAccount.assets.map((asset) => ({ ...asset }));
    account.contribution = savedAccount.contribution;
  });
  summaryTargets.clear();
  Object.entries(savedPortfolio.summaryTargets).forEach(([name, target]) => {
    summaryTargets.set(name, target);
  });
  activeAccount = accounts.find((account) => account.id === savedPortfolio.activeAccountId);
  assets = activeAccount.assets;
}

function savePortfolioState() {
  if (!hasCompletedInitialRender) return;

  activeAccount.assets = assets;
  activeAccount.contribution = getContributionCents();
  const selectedTab = document.querySelector('.tab-button[aria-selected="true"]')?.dataset.account
    ?? activeAccount.id;
  const state = {
    version: 1,
    activeAccountId: activeAccount.id,
    activeTab: selectedTab,
    accounts: accounts.map((account) => ({
      id: account.id,
      contribution: account.contribution,
      assets: account.assets.map((asset) => ({
        name: asset.name,
        target: Number(asset.target) || 0,
        current: Number(asset.current) || 0,
        allowSale: asset.allowSale,
      })),
    })),
    summaryTargets: Object.fromEntries(summaryTargets),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    setStorageStatus("Changes saved in this browser.", false);
  } catch (error) {
    setStorageStatus(`Could not save portfolio data: ${error.message}`, true);
  }
}

function toCents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatMoney(cents) {
  return moneyFormatter.format(cents / 100);
}

function formatPercent(value) {
  return `${percentFormatter.format(value)}%`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function setMessage(text, isError = false) {
  messageElement.textContent = text;
  messageElement.classList.toggle("is-error", isError);
}

function getContributionCents() {
  return toCents(contributionInput.value);
}

function setContributionCents(cents) {
  activeAccount.contribution = cents;
  contributionInput.value = (cents / 100).toFixed(2);
  syncContributionSlider(cents / 100);
}

function syncContributionSlider(value) {
  const range = 10000;
  const min = Number(contributionSlider.min);
  const max = Number(contributionSlider.max);
  if (value < min) contributionSlider.min = String(Math.floor(value / range) * range);
  if (value > max) contributionSlider.max = String(Math.ceil(value / range) * range);
  contributionSlider.value = String(value);
}

function splitCents(totalCents, weightedAssets) {
  const totalWeight = weightedAssets.reduce((total, asset) => total + asset.target, 0);
  if (totalWeight <= 0) return weightedAssets.map(() => 0);

  const result = weightedAssets.map((asset) => Math.floor(totalCents * asset.target / totalWeight));
  let remainder = totalCents - result.reduce((total, amount) => total + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % result.length) {
    if (weightedAssets[index].target > 0) {
      result[index] += 1;
      remainder -= 1;
    }
  }
  return result;
}

function minimumFinalTotalForBuyOnly(weightedAssets) {
  const constrainedAssets = weightedAssets.filter((asset) => !asset.allowSale);
  const minimumTotal = constrainedAssets.reduce((minimum, asset) => {
    const target = Number(asset.target) || 0;
    if (asset.currentCents > 0 && target <= 0) return Infinity;
    if (target <= 0) return minimum;
    return Math.max(minimum, Math.ceil((asset.currentCents * 100 - 1e-8) / target));
  }, 0);

  if (!Number.isFinite(minimumTotal)) return Infinity;
  let total = minimumTotal;
  while (splitCents(total, weightedAssets).some((amount, index) =>
    !weightedAssets[index].allowSale && amount < weightedAssets[index].currentCents)) {
    total += 1;
  }
  return total;
}

function allocateWithoutBuying(totalCents, weightedAssets) {
  const allocations = weightedAssets.map(() => 0);
  let remaining = totalCents;
  let active = weightedAssets
    .map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => asset.currentCents > 0);

  while (remaining > 0 && active.length > 0) {
    const totalWeight = active.reduce((total, { asset }) => total + asset.target, 0);
    const weighted = active.map(({ asset }) => ({
      target: totalWeight > 0 ? asset.target : asset.currentCents,
    }));
    const proposed = splitCents(remaining, weighted);
    const capped = active.filter(({ asset }, index) => proposed[index] > asset.currentCents);

    if (capped.length === 0) {
      active.forEach(({ index }, allocationIndex) => {
        allocations[index] = proposed[allocationIndex];
      });
      remaining = 0;
      break;
    }

    capped.forEach(({ asset, index }) => {
      allocations[index] = asset.currentCents;
      remaining -= asset.currentCents;
    });
    const cappedIndexes = new Set(capped.map(({ index }) => index));
    active = active.filter(({ index }) => !cappedIndexes.has(index));
  }

  return remaining === 0 ? allocations : null;
}

function calculate() {
  activeAccount.assets = assets;
  activeAccount.contribution = getContributionCents();
  const currentTotal = assets.reduce((total, asset) => total + toCents(asset.current), 0);
  const targetTotal = assets.reduce((total, asset) => total + (Number(asset.target) || 0), 0);
  const targetsInRange = assets.every((asset) => {
    const target = Number(asset.target);
    return Number.isFinite(target) && target >= 0 && target <= 100;
  });
  const contribution = getContributionCents();
  const weightedAssets = assets
    .map((asset, index) => ({ ...asset, index, currentCents: toCents(asset.current) }))
    .map((asset) => ({ ...asset, target: Number(asset.target) || 0 }));
  const targetsValid = assets.length > 0 && targetsInRange && Math.abs(targetTotal - 100) < 0.005;
  const finalTotal = currentTotal + contribution;
  const isWithdrawal = contribution < 0;
  const desiredAllocations = isWithdrawal
    ? allocateWithoutBuying(finalTotal, weightedAssets)
    : splitCents(Math.max(0, finalTotal), weightedAssets);
  const canAllocate = desiredAllocations !== null;
  const saleProceeds = weightedAssets.reduce((total, asset, index) => {
    const difference = (desiredAllocations?.[index] ?? asset.currentCents) - asset.currentCents;
    return total + (asset.allowSale && difference < 0 ? -difference : 0);
  }, 0);
  const buyBudget = contribution + saleProceeds;
  const buyNeeds = (desiredAllocations ?? []).length > 0 ? weightedAssets
    .map((asset, index) => ({ ...asset, target: Math.max(0, desiredAllocations[index] - asset.currentCents) }))
    .filter((asset) => asset.target > 0) : [];
  const totalBuyNeeds = buyNeeds.reduce((total, asset) => total + asset.target, 0);
  const isValid = targetsValid && finalTotal >= 0 && canAllocate;
  const trades = assets.map(() => 0);

  if (isValid) {
    if (isWithdrawal) {
      weightedAssets.forEach((asset, index) => {
        trades[asset.index] = desiredAllocations[index] - asset.currentCents;
      });
    } else {
      weightedAssets.forEach((asset, index) => {
        const difference = desiredAllocations[index] - asset.currentCents;
        if (asset.allowSale && difference < 0) trades[asset.index] = difference;
      });
      const allocations = splitCents(Math.min(buyBudget, totalBuyNeeds), buyNeeds);
      buyNeeds.forEach((asset, index) => {
        trades[asset.index] = allocations[index];
      });
      const remainingBudget = buyBudget - allocations.reduce((total, amount) => total + amount, 0);
      if (remainingBudget > 0) {
        const additionalBuys = splitCents(remainingBudget, weightedAssets);
        additionalBuys.forEach((amount, index) => {
          trades[index] += amount;
        });
      }
    }
  }

  const finalValues = assets.map((asset, index) => toCents(asset.current) + trades[index]);
  const holdingsFinalTotal = finalValues.reduce((total, value) => total + value, 0);
  const allocationTotalRounded = Math.round(targetTotal * 10) / 10;

  allocationTotalElement.textContent = `${formatPercent(allocationTotalRounded)} allocated`;
  allocationTotalElement.classList.toggle("is-valid", targetsValid);
  document.querySelector("#target-total").textContent = formatPercent(targetTotal);
  document.querySelector("#current-value-total").textContent = formatMoney(currentTotal);
  document.querySelector("#current-percent-total").textContent = currentTotal > 0 ? "100.0%" : "0.0%";
  document.querySelector("#trade-total").textContent = formatMoney(trades.reduce((total, amount) => total + amount, 0));
  document.querySelector("#final-value-total").textContent = formatMoney(holdingsFinalTotal);
  document.querySelector("#final-percent-total").textContent = holdingsFinalTotal > 0 ? "100.0%" : "0.0%";
  document.querySelector("#current-total").textContent = formatMoney(currentTotal);
  document.querySelector("#final-total").textContent = formatMoney(holdingsFinalTotal);
  document.querySelector("#chart-total").textContent = formatMoney(holdingsFinalTotal);

  rowsElement.querySelectorAll("tr").forEach((row, index) => {
    const currentCents = toCents(assets[index].current);
    const currentPercent = currentTotal > 0 ? currentCents / currentTotal * 100 : 0;
    const finalPercent = holdingsFinalTotal > 0 ? finalValues[index] / holdingsFinalTotal * 100 : 0;
    const trade = row.querySelector(".trade-value");
    const finalValue = row.querySelector(".final-value");
    row.querySelector(".current-percent").textContent = formatPercent(currentPercent);
    trade.textContent = formatMoney(trades[index]);
    trade.classList.toggle("positive", trades[index] > 0);
    trade.classList.toggle("negative", trades[index] < 0);
    finalValue.textContent = formatMoney(finalValues[index]);
    row.querySelector(".final-percent").textContent = formatPercent(finalPercent);
  });

  if (!targetsValid) {
    setMessage("Enter target percentages from 0% to 100% that add up to 100%.", true);
  } else if (finalTotal < 0) {
    setMessage("The withdrawal is larger than the current portfolio value.", true);
  } else if (!canAllocate) {
    setMessage("This cash amount cannot be allocated across the current holdings.", true);
  } else if (isWithdrawal) {
    setMessage("Withdrawals are sell-only; no buys are generated, and sale checkboxes do not apply.");
  } else {
    const sellEnabledCount = weightedAssets.filter((asset) => asset.allowSale).length;
    setMessage(sellEnabledCount > 0
      ? "Unchecked assets will only be bought; checked assets may be sold to reach their target."
      : "Buy-only mode: no asset will be sold unless its checkbox is checked.");
  }

  renderChart(currentTotal, holdingsFinalTotal, finalValues);
  renderSummary();
  savePortfolioState();
  return {
    currentTotal,
    targetTotal,
    contribution,
    targetsValid,
    weightedAssets,
    isValid,
  };
}

function getSummaryAssets() {
  const totals = new Map();
  for (const asset of initialAssets) {
    totals.set(asset.name, 0);
  }
  accounts.forEach((account) => {
    account.assets.forEach((asset, index) => {
      const name = asset.name.trim() || `Asset ${index + 1}`;
      totals.set(name, (totals.get(name) || 0) + toCents(asset.current));
      if (!summaryTargets.has(name)) summaryTargets.set(name, 0);
    });
  });
  return [...totals.entries()].map(([name, currentCents]) => ({ name, currentCents }));
}

function updateSummaryAllocationStatus(summaryAssets = getSummaryAssets()) {
  const targetTotal = summaryAssets.reduce((total, asset) => total + (Number(summaryTargets.get(asset.name)) || 0), 0);
  const targetsInRange = summaryAssets.every((asset) => {
    const target = Number(summaryTargets.get(asset.name));
    return Number.isFinite(target) && target >= 0 && target <= 100;
  });
  const targetsValid = summaryAssets.length > 0 && targetsInRange && Math.abs(targetTotal - 100) < 0.005;
  const currentTotal = summaryAssets.reduce((total, asset) => total + asset.currentCents, 0);
  document.querySelector("#summary-allocation-total").textContent = `${formatPercent(Math.round(targetTotal * 10) / 10)} allocated`;
  document.querySelector("#summary-allocation-total").classList.toggle("is-valid", targetsValid);
  document.querySelector("#summary-target-total").textContent = formatPercent(targetTotal);
  document.querySelector("#summary-current-total").textContent = formatMoney(currentTotal);
  document.querySelector("#summary-current-percent-total").textContent = currentTotal > 0 ? "100.0%" : "0.0%";
}

function renderSummary() {
  const summaryAssets = getSummaryAssets();
  const currentTotal = summaryAssets.reduce((total, asset) => total + asset.currentCents, 0);
  summaryRowsElement.innerHTML = summaryAssets.map((asset) => {
    const target = summaryTargets.get(asset.name) ?? 0;
    const currentPercent = currentTotal > 0 ? asset.currentCents / currentTotal * 100 : 0;
    return `<tr>
      <th scope="row">${escapeHtml(asset.name)}</th>
      <td data-label="Overall target"><input class="field-input numeric-input summary-target-input" data-asset="${escapeHtml(asset.name)}" type="number" min="0" max="100" step="0.1" inputmode="decimal" aria-label="${escapeHtml(asset.name)} overall target percentage" value="${escapeHtml(target)}"></td>
      <td data-label="Combined current value">${formatMoney(asset.currentCents)}</td>
      <td data-label="Overall current allocation">${formatPercent(currentPercent)}</td>
    </tr>`;
  }).join("");
  updateSummaryAllocationStatus(summaryAssets);
}

function renderChart(currentTotal, finalTotal, finalValues) {
  const targetSegments = [];
  const currentSegments = [];
  const finalSegments = [];
  const legend = document.querySelector("#chart-legend");
  let targetOffset = 0;
  let currentOffset = 0;
  let finalOffset = 0;

  assets.forEach((asset, index) => {
    const color = palette[index % palette.length];
    const target = Math.max(0, Number(asset.target) || 0);
    const currentCents = toCents(asset.current);
    const currentPercent = currentTotal > 0 ? currentCents / currentTotal * 100 : 0;
    const finalPercent = finalTotal > 0 ? Math.max(0, finalValues[index] / finalTotal * 100) : 0;
    if (target > 0) {
      targetSegments.push(`${color} ${targetOffset}% ${targetOffset + target}%`);
      targetOffset += target;
    }
    if (currentPercent > 0) {
      currentSegments.push(`${color} ${currentOffset}% ${currentOffset + currentPercent}%`);
      currentOffset += currentPercent;
    }
    if (finalPercent > 0) {
      finalSegments.push(`${color} ${finalOffset}% ${finalOffset + finalPercent}%`);
      finalOffset += finalPercent;
    }
  });

  document.querySelector("#target-ring").style.background = targetSegments.length
    ? `conic-gradient(${targetSegments.join(", ")})`
    : "#393b3e";
  document.querySelector("#current-ring").style.background = currentSegments.length
    ? `conic-gradient(${currentSegments.join(", ")})`
    : "#393b3e";
  document.querySelector("#final-ring").style.background = finalSegments.length
    ? `conic-gradient(${finalSegments.join(", ")})`
    : "#393b3e";
  document.querySelector("#allocation-chart").setAttribute(
    "aria-label",
    `Target, current, and final allocation for ${assets.length} asset${assets.length === 1 ? "" : "s"}. Current portfolio ${formatMoney(currentTotal)}; final value ${formatMoney(finalTotal)}.`,
  );
  legend.innerHTML = `<div class="legend-item legend-heading">
    <span></span><span>Asset</span><span>Target</span><span>Current</span><span>Final</span>
  </div>${assets.map((asset, index) => {
    const name = asset.name.trim() || `Asset ${index + 1}`;
    const targetPercent = Math.max(0, Number(asset.target) || 0);
    const currentPercent = currentTotal > 0 ? toCents(asset.current) / currentTotal * 100 : 0;
    const finalPercent = finalTotal > 0 ? finalValues[index] / finalTotal * 100 : 0;
    return `<div class="legend-item">
      <span class="legend-swatch" style="background:${palette[index % palette.length]}"></span>
      <span class="legend-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <span class="legend-value">${formatPercent(targetPercent)}</span>
      <span class="legend-value">${formatPercent(currentPercent)}</span>
      <span class="legend-value">${formatPercent(finalPercent)}</span>
    </div>`;
  }).join("")}`;
}

function renderRows() {
  rowsElement.innerHTML = assets.map((asset, index) => {
    const label = escapeHtml(asset.name.trim() || `Asset ${index + 1}`);
    return `
      <tr>
        <td class="asset-name-cell"><input class="field-input asset-name-input" data-field="name" data-index="${index}" type="text" maxlength="40" placeholder="e.g. Total Stock" aria-label="${label} name" value="${escapeHtml(asset.name)}"></td>
        <td data-label="Target %"><input class="field-input numeric-input" data-field="target" data-index="${index}" type="number" min="0" max="100" step="0.1" inputmode="decimal" aria-label="${label} target percentage" value="${escapeHtml(asset.target)}"></td>
        <td data-label="Current value"><input class="field-input money-input" data-field="current" data-index="${index}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="${label} current value" value="${escapeHtml(asset.current)}"></td>
        <td class="current-percent" data-label="Current allocation">0.0%</td>
        <td data-label="Allow sale"><input class="rebalance-check" data-field="allowSale" data-index="${index}" type="checkbox" aria-label="Allow selling ${label}" ${asset.allowSale ? "checked" : ""}></td>
        <td class="trade-value" data-label="Buy / sell">$0.00</td>
        <td class="final-value" data-label="Final value">$0.00</td>
        <td class="final-percent" data-label="Final allocation">0.0%</td>
        <td class="remove-cell"><button class="remove-asset" data-remove="${index}" type="button" aria-label="Remove ${label}">×</button></td>
      </tr>
    `;
  }).join("");
  const selectedCount = assets.filter((asset) => asset.allowSale).length;
  const selectAll = document.querySelector("#select-all");
  selectAll.checked = assets.length > 0 && selectedCount === assets.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < assets.length;
  calculate();
}

rowsElement.addEventListener("focusin", (event) => {
  const input = event.target;
  if (input.matches(".numeric-input, .money-input")
    && input.value !== ""
    && Number(input.value) === 0) {
    input.value = "";
  }
});

rowsElement.addEventListener("focusout", (event) => {
  const input = event.target;
  if (input.matches(".numeric-input, .money-input") && input.value === "") {
    input.value = "0";
  }
});

rowsElement.addEventListener("input", (event) => {
  const input = event.target;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!Number.isInteger(index) || !field || !assets[index]) return;

  if (field === "name") {
    assets[index].name = input.value;
    const label = assets[index].name.trim() || `Asset ${index + 1}`;
    input.setAttribute("aria-label", `${label} name`);
    rowsElement.querySelector(`[data-field="target"][data-index="${index}"]`)
      ?.setAttribute("aria-label", `${label} target percentage`);
    rowsElement.querySelector(`[data-field="current"][data-index="${index}"]`)
      ?.setAttribute("aria-label", `${label} current value`);
    rowsElement.querySelector(`[data-field="allowSale"][data-index="${index}"]`)
      ?.setAttribute("aria-label", `Allow selling ${label}`);
    rowsElement.querySelector(`[data-remove="${index}"]`)
      ?.setAttribute("aria-label", `Remove ${label}`);
    calculate();
    return;
  }
  if (field === "target") {
    assets[index].target = input.value === "" ? 0 : Number(input.value);
  } else if (field === "current") {
    assets[index].current = input.value === "" ? 0 : Math.max(0, Number(input.value) || 0);
  } else if (field === "allowSale") {
    assets[index].allowSale = input.checked;
    const selectedCount = assets.filter((asset) => asset.allowSale).length;
    const selectAll = document.querySelector("#select-all");
    selectAll.checked = selectedCount === assets.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < assets.length;
  }
  calculate();
});

rowsElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  assets.splice(Number(button.dataset.remove), 1);
  renderRows();
});

document.querySelector("#add-asset").addEventListener("click", () => {
  assets.push({ name: "", target: 0, current: 0, allowSale: false });
  renderRows();
  rowsElement.querySelector(`input[data-field="name"][data-index="${assets.length - 1}"]`)?.focus();
});

document.querySelector("#select-all").addEventListener("change", (event) => {
  assets = assets.map((asset) => ({ ...asset, allowSale: event.target.checked }));
  renderRows();
});

summaryRowsElement.addEventListener("focusin", (event) => {
  const input = event.target;
  if (input.matches(".summary-target-input") && input.value !== "" && Number(input.value) === 0) {
    input.value = "";
  }
});

summaryRowsElement.addEventListener("focusout", (event) => {
  const input = event.target;
  if (input.matches(".summary-target-input") && input.value === "") {
    input.value = "0";
  }
});

summaryRowsElement.addEventListener("input", (event) => {
  const input = event.target;
  if (!input.matches(".summary-target-input")) return;
  summaryTargets.set(input.dataset.asset, input.value === "" ? 0 : Number(input.value));
  updateSummaryAllocationStatus();
  savePortfolioState();
});

document.querySelector(".tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-account]");
  if (!tab) return;
  const selectedId = tab.dataset.account;
  const isSummary = selectedId === "summary";
  if (!isSummary) {
    activeAccount = accounts.find((account) => account.id === selectedId);
    assets = activeAccount.assets;
  }

  document.querySelectorAll(".tab-button").forEach((button) => {
    const selected = button === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelector("#reset-button").hidden = isSummary;
  accountView.hidden = isSummary;
  summaryView.hidden = !isSummary;

  if (isSummary) {
    summaryView.setAttribute("aria-labelledby", tab.id);
    renderSummary();
    savePortfolioState();
    return;
  }

  accountView.setAttribute("aria-labelledby", tab.id);
  setContributionCents(activeAccount.contribution);
  renderRows();
});

contributionInput.addEventListener("input", () => {
  const value = Number(contributionInput.value) || 0;
  syncContributionSlider(value);
  calculate();
});

contributionSlider.addEventListener("input", () => {
  contributionInput.value = Number(contributionSlider.value).toFixed(2);
  calculate();
});

document.querySelector("#auto-calculate").addEventListener("click", () => {
  const { currentTotal, weightedAssets, targetsValid } = calculate();
  if (!targetsValid) {
    setMessage("Enter target percentages from 0% to 100% that add up to 100%.", true);
    return;
  }
  const minimumFinalTotal = minimumFinalTotalForBuyOnly(weightedAssets);
  if (!Number.isFinite(minimumFinalTotal)) {
    setMessage("A holding with a 0% target cannot be kept without selling. Check it to allow a sale.", true);
    return;
  }
  setContributionCents(Math.max(0, minimumFinalTotal - currentTotal));
  calculate();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  assets = initialAssets.map((asset) => ({ ...asset }));
  activeAccount.assets = assets;
  setContributionCents(0);
  renderRows();
});

const initialTabId = savedPortfolio?.activeTab === "summary"
  ? "summary"
  : activeAccount.id;
document.querySelectorAll(".tab-button").forEach((button, index, buttons) => {
  const selected = button.dataset.account === initialTabId;
  button.setAttribute("aria-selected", String(selected));
  button.tabIndex = selected ? 0 : -1;
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Array.from(buttons).indexOf(button);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? buttons.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  });
});

accountView.hidden = initialTabId === "summary";
summaryView.hidden = initialTabId !== "summary";
document.querySelector("#reset-button").hidden = initialTabId === "summary";
accountView.setAttribute("aria-labelledby", `tab-${activeAccount.id}`);
summaryView.setAttribute("aria-labelledby", "tab-summary");
setContributionCents(activeAccount.contribution);
if (savedPortfolio) setStorageStatus("Restored saved portfolio from this browser.");
renderRows();
hasCompletedInitialRender = true;

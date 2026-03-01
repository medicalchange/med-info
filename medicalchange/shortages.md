---
layout: minimal
title: Drug Shortages
permalink: /shortages/
---

<h2>Active Drug Shortages (Canada)</h2>
<p>Nightly static snapshot from Health Product Shortages Canada.</p>
<p id="shortage-refresh-ts"><strong>Last refreshed:</strong> loading...</p>
<p id="shortage-refresh-badges"></p>
<div id="shortage-new-widget"></div>
<div id="shortage-history-widget"></div>
<label for="shortage-search"><strong>Search drugs:</strong></label>
<input id="shortage-search" type="text" placeholder="Type a drug name" style="display:block;max-width:420px;width:100%;padding:8px;margin:8px 0 14px 0;" />
<div id="drug-shortage-widget"></div>

<script>
document.addEventListener("DOMContentLoaded", async function () {
  const mount = document.getElementById("drug-shortage-widget");
  const newMount = document.getElementById("shortage-new-widget");
  const historyMount = document.getElementById("shortage-history-widget");
  const searchInput = document.getElementById("shortage-search");
  const tsEl = document.getElementById("shortage-refresh-ts");
  const badgeEl = document.getElementById("shortage-refresh-badges");
  if (!mount || !newMount || !historyMount || !searchInput) return;

  const staticSnapshotUrl = "https://raw.githubusercontent.com/medicalchange/drug-shortage-feed/main/data/condensed-shortages.json";
  let allItems = [];

  function fmtDate(value) {
    if (!value) return "n/a";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleDateString();
  }

  function fmtTimestamp(value) {
    if (!value) return "n/a";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleString();
  }

  function esc(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderRows(items) {
    return items
      .map((entry) => {
        const doseText = Array.isArray(entry.doses) && entry.doses.length ? entry.doses.join(', ') : 'n/a';
        const etaText = fmtDate(entry.expectedBackInStockDate);
        const drug = entry.drug || "Unnamed product";
        return `<li><strong>${esc(drug)}</strong> | Dose(s): ${esc(doseText)} | Expected back: ${esc(etaText)}</li>`;
      })
      .join('');
  }

  function renderMainList(items) {
    const rows = renderRows(items);
    if (!rows) {
      mount.innerHTML = '<p>No active shortages found for this search.</p>';
      return;
    }
    mount.innerHTML = `<h3>All Active Shortages (${items.length})</h3><ul>${rows}</ul>`;
  }

  function setFreshnessBadges(refreshedAt) {
    if (!badgeEl) return;
    const d = new Date(refreshedAt);
    if (Number.isNaN(d.getTime())) {
      badgeEl.innerHTML = '';
      return;
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(dayStart.getDate() - 7);

    const badges = [];
    if (d >= dayStart) badges.push('Updated Today');
    if (d >= weekStart) badges.push('Updated This Week');

    badgeEl.innerHTML = badges.length
      ? badges.map((b) => `<span style="display:inline-block;margin-right:8px;padding:3px 8px;border:1px solid #ccc;border-radius:999px;font-size:12px;">${esc(b)}</span>`).join('')
      : '<span style="font-size:12px;color:#666;">Not updated in the last 7 days</span>';
  }

  function renderHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
      historyMount.innerHTML = '<h3>Recent Additions History (Last 14 Refreshes)</h3><p>No history available yet.</p>';
      return;
    }

    const withAdditions = history
      .filter((entry) => Number(entry.addedDrugsCount || 0) > 0)
      .slice(0, 14);

    if (withAdditions.length === 0) {
      historyMount.innerHTML = '<h3>Recent Additions History (Last 14 Refreshes)</h3><p>No refreshes with additions yet.</p>';
      return;
    }

    const rows = withAdditions.map((entry) => {
      const dateLabel = fmtTimestamp(entry.refreshedAt);
      const addedCount = Number(entry.addedDrugsCount || 0);
      const names = Array.isArray(entry.addedDrugs)
        ? entry.addedDrugs.map((d) => d.drug).slice(0, 6).join(', ')
        : '';
      const namesLabel = names ? ` | Drugs: ${esc(names)}${addedCount > 6 ? ', ...' : ''}` : '';
      return `<li><strong>${esc(dateLabel)}</strong> | Added: ${addedCount}${namesLabel}</li>`;
    }).join('');

    historyMount.innerHTML = `<h3>Recent Additions History (Last 14 Refreshes)</h3><ul>${rows}</ul>`;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  mount.innerHTML = '<p>Loading shortages...</p>';
  newMount.innerHTML = '<p>Loading new additions...</p>';
  historyMount.innerHTML = '<p>Loading refresh history...</p>';

  try {
    const payload = await fetchJson(staticSnapshotUrl);
    allItems = Array.isArray(payload.results) ? payload.results : [];
    const added = Array.isArray(payload.addedDrugs) ? payload.addedDrugs : [];
    const history = Array.isArray(payload.addedHistory) ? payload.addedHistory : [];

    if (tsEl) {
      const refreshedAt = payload.refreshedAt ? fmtTimestamp(payload.refreshedAt) : "n/a";
      tsEl.innerHTML = `<strong>Last refreshed:</strong> ${esc(refreshedAt)}`;
      setFreshnessBadges(payload.refreshedAt);
    }

    const addedRows = renderRows(added);
    if (addedRows) {
      newMount.innerHTML = `
        <h3>New Since Last Refresh (${added.length})</h3>
        <ul>${addedRows}</ul>
      `;
    } else {
      newMount.innerHTML = '<h3>New Since Last Refresh</h3><p>No newly added drugs since the previous refresh.</p>';
    }

    renderHistory(history);
    renderMainList(allItems);

    searchInput.addEventListener('input', function () {
      const query = String(searchInput.value || '').trim().toLowerCase();
      if (!query) {
        renderMainList(allItems);
        return;
      }

      const filtered = allItems.filter((entry) => {
        const drug = String(entry.drug || '').toLowerCase();
        const doses = Array.isArray(entry.doses) ? entry.doses.join(' ').toLowerCase() : '';
        return drug.includes(query) || doses.includes(query);
      });
      renderMainList(filtered);
    });
  } catch (error) {
    newMount.innerHTML = '';
    historyMount.innerHTML = '';
    mount.innerHTML = `<p>Failed to load shortages: ${esc(error.message)}</p>`;
  }
});
</script>

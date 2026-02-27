---
layout: minimal
title: Drug Shortages
permalink: /shortages/
---

<h2>Active Drug Shortages (Canada)</h2>
<p>Includes active shortage reports with expected back-in-stock dates when available.</p>
<p id="shortage-refresh-ts"><strong>Last refreshed:</strong> loading...</p>
<div id="shortage-new-widget"></div>
<div id="drug-shortage-widget"></div>

<script>
document.addEventListener("DOMContentLoaded", async function () {
  const mount = document.getElementById("drug-shortage-widget");
  const newMount = document.getElementById("shortage-new-widget");
  if (!mount || !newMount) return;

  const apiBaseUrl = "https://drug-shortage-feed.onrender.com";
  const condensedUrl = `${apiBaseUrl}/api/shortages/condensed?status=active&type=shortage&resolved=false&require_eta=true&limit=1000`;
  const tsEl = document.getElementById("shortage-refresh-ts");

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

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  mount.innerHTML = '<p>Loading shortages...</p>';
  newMount.innerHTML = '<p>Loading new additions...</p>';

  try {
    const payload = await fetchJson(condensedUrl);
    const items = Array.isArray(payload.results) ? payload.results : [];
    const added = Array.isArray(payload.addedDrugs) ? payload.addedDrugs : [];

    if (tsEl) {
      const refreshedAt = payload.refreshedAt ? fmtTimestamp(payload.refreshedAt) : "n/a";
      tsEl.innerHTML = `<strong>Last refreshed:</strong> ${esc(refreshedAt)}`;
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

    const rows = renderRows(items);
    if (!rows) {
      mount.innerHTML = '<p>No active shortages found.</p>';
      return;
    }

    mount.innerHTML = `<h3>All Active Shortages (${items.length})</h3><ul>${rows}</ul>`;
  } catch (error) {
    newMount.innerHTML = '';
    mount.innerHTML = `<p>Failed to load shortages: ${esc(error.message)}</p>`;
  }
});
</script>

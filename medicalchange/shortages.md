---
layout: minimal
title: Drug Shortages
permalink: /shortages/
---

<h2>Active Drug Shortages (Canada)</h2>
<p>Includes active shortage reports with expected back-in-stock dates when available.</p>
<div id="drug-shortage-widget"></div>

<script>
document.addEventListener("DOMContentLoaded", async function () {
  const mount = document.getElementById("drug-shortage-widget");
  if (!mount) return;

  const apiBaseUrl = "https://drug-shortage-feed.onrender.com";
  const url = `${apiBaseUrl}/api/shortages?status=active&type=shortage&resolved=false&require_eta=true&limit=500`;

  function fmtDate(value) {
    if (!value) return "n/a";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleDateString();
  }

  function esc(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  mount.innerHTML = '<p>Loading shortages...</p>';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);

    const payload = await response.json();
    const items = Array.isArray(payload.results) ? payload.results : [];

    const grouped = new Map();
    for (const item of items) {
      const name = (item.brandName || "Unnamed product").trim();
      const doses = String(item.strength || "")
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);

      const eta = item.expectedBackInStockDate ? new Date(item.expectedBackInStockDate) : null;
      const etaTs = eta && !Number.isNaN(eta.getTime()) ? eta.getTime() : null;

      if (!grouped.has(name)) {
        grouped.set(name, { name, doses: new Set(), earliestEtaTs: etaTs });
      }

      const current = grouped.get(name);
      doses.forEach((d) => current.doses.add(d));
      if (etaTs !== null && (current.earliestEtaTs === null || etaTs < current.earliestEtaTs)) {
        current.earliestEtaTs = etaTs;
      }
    }

    const rows = [...grouped.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const doseText = entry.doses.size ? [...entry.doses].sort().join(', ') : 'n/a';
        const etaText = entry.earliestEtaTs ? fmtDate(new Date(entry.earliestEtaTs).toISOString()) : 'n/a';
        return `<li><strong>${esc(entry.name)}</strong> | Dose(s): ${esc(doseText)} | Expected back: ${esc(etaText)}</li>`;
      })
      .join('');

    if (!rows) {
      mount.innerHTML = '<p>No active shortages found.</p>';
      return;
    }

    mount.innerHTML = `<ul>${rows}</ul>`;
  } catch (error) {
    mount.innerHTML = `<p>Failed to load shortages: ${esc(error.message)}</p>`;
  }
});
</script>

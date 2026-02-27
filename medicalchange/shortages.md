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
  const condensedUrl = `${apiBaseUrl}/api/shortages/condensed?status=active&type=shortage&resolved=false&require_eta=true&limit=1000`;
  const fullUrl = `${apiBaseUrl}/api/shortages?status=active&type=shortage&resolved=false&require_eta=true&limit=1000`;

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

  function normalizeDrugName(value) {
    let out = String(value || "").trim();
    if (!out) return "Unnamed product";
    if (out.includes("-")) out = out.replace(/^[^-]+-\s*/, "");
    while (/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i.test(out)) {
      out = out.replace(/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i, "");
    }
    return out.trim() || "Unnamed product";
  }

  function toCondensedFromFull(items) {
    const grouped = new Map();

    for (const item of items) {
      const drug = normalizeDrugName(item.brandName || "Unnamed product");
      const doses = String(item.strength || "")
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);

      const eta = item.expectedBackInStockDate ? new Date(item.expectedBackInStockDate) : null;
      const etaTs = eta && !Number.isNaN(eta.getTime()) ? eta.getTime() : null;

      if (!grouped.has(drug)) {
        grouped.set(drug, { drug, doses: new Set(), earliestEtaTs: etaTs });
      }

      const row = grouped.get(drug);
      doses.forEach((d) => row.doses.add(d));
      if (etaTs !== null && (row.earliestEtaTs === null || etaTs < row.earliestEtaTs)) {
        row.earliestEtaTs = etaTs;
      }
    }

    return [...grouped.values()]
      .sort((a, b) => a.drug.localeCompare(b.drug))
      .map((row) => ({
        drug: row.drug,
        doses: [...row.doses].sort(),
        expectedBackInStockDate: row.earliestEtaTs ? new Date(row.earliestEtaTs).toISOString() : null
      }));
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  mount.innerHTML = '<p>Loading shortages...</p>';

  try {
    let items = [];

    // 1) Try condensed endpoint (lightweight payload).
    try {
      const payload = await fetchJson(condensedUrl);
      items = Array.isArray(payload.results) ? payload.results : [];
    } catch {
      items = [];
    }

    // 2) If empty, force sync and retry condensed once.
    if (items.length === 0) {
      try {
        await fetch(`${apiBaseUrl}/api/shortages/sync`, { method: "POST" });
        const payload = await fetchJson(condensedUrl);
        items = Array.isArray(payload.results) ? payload.results : [];
      } catch {
        items = [];
      }
    }

    // 3) Final fallback: full endpoint then condense client-side.
    if (items.length === 0) {
      const payload = await fetchJson(fullUrl);
      const fullItems = Array.isArray(payload.results) ? payload.results : [];
      items = toCondensedFromFull(fullItems);
    }

    const rows = items
      .map((entry) => {
        const doseText = Array.isArray(entry.doses) && entry.doses.length ? entry.doses.join(', ') : 'n/a';
        const etaText = fmtDate(entry.expectedBackInStockDate);
        const drug = normalizeDrugName(entry.drug || "Unnamed product");
        return `<li><strong>${esc(drug)}</strong> | Dose(s): ${esc(doseText)} | Expected back: ${esc(etaText)}</li>`;
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

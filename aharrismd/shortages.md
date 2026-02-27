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
  const url = `${apiBaseUrl}/api/shortages/condensed?status=active&type=shortage&resolved=false&require_eta=true&limit=1000`;

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
    out = out.replace(/^APO[\s-]+/i, "");
    return out.trim() || "Unnamed product";
  }

  mount.innerHTML = '<p>Loading shortages...</p>';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);

    const payload = await response.json();
    const items = Array.isArray(payload.results) ? payload.results : [];

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

---
layout: minimal
title: Drug Shortages
permalink: /shortages/
---

<h2>Active Drug Shortages (Canada)</h2>
<p>Includes active shortage reports with expected back-in-stock dates when available.</p>
<p id="shortage-refresh-ts"><strong>Last refreshed:</strong> loading...</p>
<div id="drug-shortage-widget"></div>

<script>
document.addEventListener("DOMContentLoaded", async function () {
  const mount = document.getElementById("drug-shortage-widget");
  if (!mount) return;

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

  function normalizeDrugName(value) {
    let out = String(value || "").trim();
    if (!out) return "Unnamed product";
    if (out.includes("-")) out = out.replace(/^[^-]+-\s*/, "");
    while (/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i.test(out)) {
      out = out.replace(/^(APO|JAMP|SANDOZ|ACT)[\s-]+/i, "");
    }
    return out.trim() || "Unnamed product";
  }

  function isDisplayableDrugName(name) {
    const value = String(name || "").trim();
    if (!value) return false;
    if (/^\d/.test(value)) return false;
    return value.length > 3;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  mount.innerHTML = '<p>Loading shortages...</p>';

  try {
    const payload = await fetchJson(condensedUrl);
    const items = Array.isArray(payload.results) ? payload.results : [];

    if (tsEl) {
      const refreshedAt = payload.refreshedAt ? fmtTimestamp(payload.refreshedAt) : "n/a";
      tsEl.innerHTML = `<strong>Last refreshed:</strong> ${esc(refreshedAt)}`;
    }

    const rows = items
      .map((entry) => {
        const doseText = Array.isArray(entry.doses) && entry.doses.length ? entry.doses.join(', ') : 'n/a';
        const etaText = fmtDate(entry.expectedBackInStockDate);
        const drug = normalizeDrugName(entry.drug || "Unnamed product");
        if (!isDisplayableDrugName(drug)) return "";
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

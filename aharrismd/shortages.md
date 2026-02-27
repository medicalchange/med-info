---
layout: minimal
title: Drug Shortages
permalink: /shortages/
---

<h2>Active Drug Shortages (Canada)</h2>
<p>Includes active shortage reports with expected back-in-stock dates when available.</p>
<div id="drug-shortage-widget"></div>

<script src="https://YOUR-SHORTAGE-SERVICE/shortage-widget.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  if (!window.DrugShortageWidget) return;
  window.DrugShortageWidget.init({
    apiBaseUrl: "https://YOUR-SHORTAGE-SERVICE",
    mountSelector: "#drug-shortage-widget",
    mode: "all",
    statusFilter: "active",
    typeFilter: "shortage",
    resolvedFilter: "false",
    requireEta: true,
    limit: 500,
    title: "Active Canada Drug Shortages"
  });
});
</script>

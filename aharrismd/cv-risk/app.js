const form = document.querySelector("#risk-form");
const labInput = document.querySelector("#lab-input");
const summaryCard = document.querySelector("#summary-card");
const verdictCard = document.querySelector("#verdict-card");
const verdictBadge = document.querySelector("#verdict-badge");
const verdictSubtitle = document.querySelector("#verdict-subtitle");
const verdictTitle = document.querySelector("#verdict-title");
const verdictTrigger = document.querySelector("#verdict-trigger");
const verdictBody = document.querySelector("#verdict-body");
const metricsGrid = document.querySelector("#metrics-grid");
const recommendationsNode = document.querySelector("#recommendations");
const clarifyTestsNode = document.querySelector("#clarify-tests");
const followupTestsNode = document.querySelector("#followup-tests");
const rationaleNode = document.querySelector("#rationale");
const statusPill = document.querySelector("#status-pill");
const loadSampleButton = document.querySelector("#load-sample");
const copySummaryButton = document.querySelector("#copy-summary");
const summaryOutput = document.querySelector("#summary-output");
const logic = window.CVRiskLogic;

if (!logic) {
  throw new Error("CVRiskLogic failed to load before app.js");
}

const {
  SAMPLE_PANEL,
  buildAnalysis,
  parseLipidPanel,
  summarizePanel,
} = logic;

function getFormInputs() {
  const formData = new FormData(form);
  return {
    frs: formData.get("frs"),
    apoB: formData.get("apoB"),
    lpa: formData.get("lpa"),
    age: formData.get("age"),
    sex: formData.get("sex"),
    therapy: formData.get("therapy"),
    ascvd: formData.get("ascvd") === "on",
    diabetes: formData.get("diabetes") === "on",
    ckd: formData.get("ckd") === "on",
    familyHistory: formData.get("familyHistory") === "on",
    cac: formData.get("cac") === "on",
    hscrp: formData.get("hscrp") === "on",
    additionalRiskFactor: formData.get("additionalRiskFactor") === "on",
  };
}

function buildSummaryText(analysis, inputs) {
  const frsText = inputs.frs ? `${Number.parseFloat(inputs.frs).toFixed(1)}%` : "not entered";
  const markerValue =
    analysis.primaryMarker.value != null
      ? `${analysis.primaryMarker.value.toFixed(2)} mmol/L`
      : "not available";

  return [
    `FRS: ${frsText}`,
    `Preferred CCS marker: ${analysis.primaryMarker.label} (${markerValue})`,
    `Statin recommendation: ${analysis.statinAnswer}`,
    `Trigger: ${analysis.triggerSummary}`,
    `Reason: ${analysis.statinReason}`,
  ].join("\n");
}

function renderVerdict(analysis) {
  verdictCard.className = "verdict-card";
  if (analysis.statinDecision === "yes") {
    verdictCard.classList.add("verdict-yes");
  } else if (analysis.statinDecision === "consider") {
    verdictCard.classList.add("verdict-consider");
  } else if (analysis.statinDecision === "no") {
    verdictCard.classList.add("verdict-no");
  } else {
    verdictCard.classList.add("verdict-neutral");
  }

  verdictBadge.textContent = `Statin ${analysis.statinAnswer}`;
  verdictSubtitle.textContent = `${analysis.riskCategory} risk classification`;
  verdictTitle.textContent = analysis.statinDecision === "yes"
    ? "Start or continue statin-focused treatment"
    : analysis.statinDecision === "consider"
      ? "Shared statin decision"
      : analysis.statinDecision === "no"
        ? "Lifestyle-first management"
        : "Need more data";
  verdictTrigger.textContent = `Trigger: ${analysis.triggerSummary}`;
  verdictBody.textContent = analysis.statinReason;
}

function renderMetrics(panel) {
  const metrics = summarizePanel(panel);
  if (!metrics.length) {
    metricsGrid.innerHTML = '<div class="empty-state metric">No lipid values were parsed.</div>';
    return;
  }

  metricsGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric">
          <p class="metric-label">${metric.label}</p>
          <p class="metric-value">${metric.value.toFixed(2)}</p>
          <p class="metric-sub">${metric.unit || "ratio"}</p>
        </article>
      `
    )
    .join("");
}

function renderSummary(analysis, inputs) {
  const markerValue =
    analysis.primaryMarker.value != null
      ? `${analysis.primaryMarker.value.toFixed(2)} mmol/L`
      : "not available";
  const frsText = inputs.frs ? `${Number.parseFloat(inputs.frs).toFixed(1)}%` : "not entered";
  const markerLabel = analysis.primaryMarker.key === "nonHdl"
    ? '<a class="inline-anchor" href="#primary-marker-rationale">Non-HDL-C*</a>'
    : analysis.primaryMarker.label;

  summaryCard.classList.remove("empty-state");
  summaryCard.innerHTML = `
    <h3>${analysis.riskCategory} risk profile</h3>
    <p>FRS: ${frsText}</p>
    <p>Preferred CCS marker: ${markerLabel} (${markerValue})</p>
    <p>Statin recommendation: ${analysis.statinAnswer}</p>
    <p>Trigger: ${analysis.triggerSummary}</p>
    <p>Reason: ${analysis.statinReason}</p>
  `;
}

function renderRecommendations(recommendations) {
  recommendationsNode.classList.remove("empty-state");
  recommendationsNode.innerHTML = recommendations
    .map(
      (item) => `
        <article class="recommendation ${item.tone}">
          <h4>${item.title}</h4>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function renderTestGroup(node, items, emptyText) {
  if (!items.length) {
    node.classList.add("empty-state");
    node.innerHTML = emptyText;
    return;
  }

  node.classList.remove("empty-state");
  node.innerHTML = items
    .map(
      (item) => `
        <article class="secondary-test">
          <div class="test-meta">${item.timing}</div>
          <h4>${item.title}</h4>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function renderRationale(items) {
  rationaleNode.classList.remove("empty-state");
  rationaleNode.innerHTML = items
    .map(
      (item) => `
        <article class="rationale-item" ${item.title === "Primary lipid marker" ? 'id="primary-marker-rationale"' : ""}>
          <h4>${item.title}</h4>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function renderStatus(analysis) {
  statusPill.className = "status-pill";

  if (analysis.statinIndicated || analysis.riskCategory === "High") {
    statusPill.classList.add("status-alert");
    statusPill.textContent = "Escalated follow-up";
    return;
  }

  if (analysis.intermediateThresholdMet || analysis.riskModifierPresent || analysis.ageTrigger) {
    statusPill.classList.add("status-caution");
    statusPill.textContent = "Shared decision zone";
    return;
  }

  statusPill.classList.add("status-good");
  statusPill.textContent = "Lifestyle-first pattern";
}

function analyze() {
  const panel = parseLipidPanel(labInput.value);
  const inputs = getFormInputs();
  const analysis = buildAnalysis({ panel, inputs });

  renderVerdict(analysis);
  renderSummary(analysis, inputs);
  renderMetrics(panel);
  renderRecommendations(analysis.recommendations);
  renderTestGroup(clarifyTestsNode, analysis.clarifyTests, "No immediate clarification tests were suggested.");
  renderTestGroup(followupTestsNode, analysis.followupTests, "No follow-up items were suggested from the current inputs.");
  renderRationale(analysis.rationale);
  renderStatus(analysis);
  summaryOutput.value = buildSummaryText(analysis, inputs);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze();
});

loadSampleButton.addEventListener("click", () => {
  labInput.value = SAMPLE_PANEL;
  analyze();
});

copySummaryButton.addEventListener("click", async () => {
  if (!summaryOutput.value.trim()) {
    return;
  }

  try {
    await navigator.clipboard.writeText(summaryOutput.value);
    copySummaryButton.textContent = "Copied";
    window.setTimeout(() => {
      copySummaryButton.textContent = "Copy note";
    }, 1400);
  } catch (_error) {
    summaryOutput.focus();
    summaryOutput.select();
    copySummaryButton.textContent = "Select note";
    window.setTimeout(() => {
      copySummaryButton.textContent = "Copy note";
    }, 1400);
  }
});

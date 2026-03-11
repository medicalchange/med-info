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
const decisionAidNoteNode = document.querySelector("#decisionaid-note");
const decisionAidRiskNode = document.querySelector("#decisionaid-risk");
const statusPill = document.querySelector("#status-pill");
const loadSampleButton = document.querySelector("#load-sample");
const copySummaryButton = document.querySelector("#copy-summary");
const summaryOutput = document.querySelector("#summary-output");
const treatmentInputs = Array.from(document.querySelectorAll('#tx-mediterranean, #tx-activity, #tx-smoking, input[name="txMedication"]'));
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

const TREATMENT_RR = {
  mediterranean: 0.70,
  activity: 0.75,
  smoking: 0.65,
  "statin-low": 0.75,
  "statin-high": 0.65,
  "bp-med": 0.75,
  ezetimibe: 0.95,
  pcsk9: 0.85,
  fibrate: 0.85,
};

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
    diabetesAdditionalRisk: formData.get("diabetesAdditionalRisk") === "on",
    txMediterranean: document.querySelector("#tx-mediterranean").checked,
    txActivity: document.querySelector("#tx-activity").checked,
    txSmoking: document.querySelector("#tx-smoking").checked,
    txMedication: document.querySelector('input[name="txMedication"]:checked')?.value || "none",
  };
}

function buildSummaryText(analysis, inputs) {
  const frsText = inputs.frs ? `${Number.parseFloat(inputs.frs).toFixed(1)}%` : "FRS not entered";
  const markerValue =
    analysis.primaryMarker.value != null
      ? `${analysis.primaryMarker.value.toFixed(2)} mmol/L`
      : "not available";

  return [
    `FRS: ${frsText}`,
    `Preferred CCS marker: ${analysis.primaryMarker.label} (${markerValue})`,
    `Statin recommendation: ${analysis.statinAnswer}`,
    `Decision basis: ${analysis.triggerSummary}`,
    `Reason: ${analysis.statinReason}`,
  ].join("\n");
}

function clampRisk(value) {
  return Math.max(0, Math.min(100, value));
}

function buildFaces(eventCount) {
  return Array.from({ length: 100 }, (_, index) => {
    const isEvent = index < eventCount;
    return `<div class="risk-face ${isEvent ? "risk-face-event" : "risk-face-noevent"}" aria-hidden="true">${isEvent ? "☹" : "☺"}</div>`;
  }).join("");
}

function buildDecisionAidEstimate(inputs, panel) {
  const baseRisk = inputs.frs ? Number.parseFloat(inputs.frs) : null;
  if (!Number.isFinite(baseRisk)) {
    return {
      available: false,
      noteTone: "alert",
      note: 'Need more data: <span class="missing-text">FRS not entered</span>.',
    };
  }

  if (panel.nonHdl != null && panel.nonHdl >= 5.8) {
    return {
      available: false,
      noteTone: "caution",
      note: "Illustrated risk comparison unavailable because non-HDL-C is 5.8 mmol/L or higher, which can substantially underestimate risk in the PEER decision aid.",
    };
  }

  let rr = 1;
  const selectedOptions = [];
  const notes = [];

  if (inputs.txMediterranean) {
    rr *= TREATMENT_RR.mediterranean;
    selectedOptions.push("Mediterranean diet");
  }
  if (inputs.txActivity) {
    rr *= TREATMENT_RR.activity;
    selectedOptions.push("Physical activity");
  }
  if (inputs.txSmoking) {
    rr *= TREATMENT_RR.smoking;
    selectedOptions.push("Smoking cessation");
  }

  if (inputs.txMedication !== "none") {
    const medicationLabels = {
      "statin-low": "Statin (low to moderate dose)",
      "statin-high": "Statin (high dose)",
      "bp-med": "Single blood pressure medication",
      ezetimibe: "Ezetimibe",
      pcsk9: "PCSK9 inhibitor",
      fibrate: "Fibrate",
    };

    selectedOptions.push(medicationLabels[inputs.txMedication]);

    if (inputs.txMedication === "fibrate" && inputs.therapy !== "none") {
      notes.push("Fibrates do not appear to add cardiovascular benefit when already taking a statin-based regimen.");
    } else {
      rr *= TREATMENT_RR[inputs.txMedication];
    }

    if (inputs.txMedication === "ezetimibe") {
      notes.push("Ezetimibe has minimal direct evidence in primary prevention.");
    }
    if (inputs.txMedication === "pcsk9") {
      notes.push("PCSK9 inhibitors have minimal direct evidence in primary prevention.");
    }
  }

  if (inputs.therapy !== "none") {
    notes.push("This treatment comparison is approximate when the entered FRS already reflects current therapy.");
  }

  const treatedRisk = clampRisk(baseRisk * rr);
  const absoluteReduction = clampRisk(baseRisk - treatedRisk);
  const relativeReduction = baseRisk > 0 ? (absoluteReduction / baseRisk) * 100 : 0;

  return {
    available: true,
    baseRisk,
    treatedRisk,
    currentEvents: Math.round(baseRisk),
    treatedEvents: Math.round(treatedRisk),
    absoluteReduction,
    relativeReduction,
    selectedOptions,
    notes,
  };
}

function renderDecisionAid(estimate) {
  decisionAidNoteNode.className = "decisionaid-note";

  if (!estimate.available) {
    decisionAidRiskNode.className = "decisionaid-risk empty-state";
    decisionAidRiskNode.innerHTML = "No illustrated risk comparison yet.";
    decisionAidNoteNode.classList.add(estimate.noteTone === "alert" ? "decisionaid-note-alert" : "decisionaid-note-caution");
    decisionAidNoteNode.innerHTML = estimate.note;
    return;
  }

  decisionAidNoteNode.classList.add("decisionaid-note-neutral");
  decisionAidNoteNode.innerHTML = estimate.selectedOptions.length
    ? `Selected options: ${estimate.selectedOptions.join(", ")}.`
    : "No treatment option selected yet. The right-hand icon array matches baseline risk until an option is chosen.";

  const notesMarkup = estimate.notes.length
    ? `<div class="decisionaid-extra">${estimate.notes.map((note) => `<p>${note}</p>`).join("")}</div>`
    : "";

  decisionAidRiskNode.className = "decisionaid-risk";
  decisionAidRiskNode.innerHTML = `
    <div class="risk-compare">
      <article class="risk-card">
        <p class="risk-kicker">Current</p>
        <h4>${estimate.baseRisk.toFixed(1)}%</h4>
        <p class="risk-caption">${100 - estimate.currentEvents} will not have an event; ${estimate.currentEvents} will have an event.</p>
        <div class="risk-faces">${buildFaces(estimate.currentEvents)}</div>
      </article>
      <article class="risk-card risk-card-treatment">
        <p class="risk-kicker">With selected options</p>
        <h4>${estimate.treatedRisk.toFixed(1)}%</h4>
        <p class="risk-caption">Absolute change ${estimate.absoluteReduction.toFixed(1)} points; relative reduction ${estimate.relativeReduction.toFixed(0)}%.</p>
        <div class="risk-faces">${buildFaces(estimate.treatedEvents)}</div>
      </article>
    </div>
    ${notesMarkup}
  `;
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
  const missingFrs = analysis.statinDecision === "unknown" && analysis.triggerSummary.startsWith("FRS not entered");
  verdictTitle.innerHTML = analysis.statinDecision === "yes"
    ? "Start or continue statin-focused treatment"
    : analysis.statinDecision === "consider"
      ? "Shared statin decision"
      : analysis.statinDecision === "no"
        ? "Lifestyle-first management"
        : missingFrs
          ? 'Need more data: <span class="missing-text">FRS not entered</span>'
          : "Need more data";
  verdictTrigger.textContent = `Decision basis: ${analysis.triggerSummary}`;
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
  const frsText = inputs.frs
    ? `${Number.parseFloat(inputs.frs).toFixed(1)}%`
    : '<span class="missing-text">FRS not entered</span>';
  const markerLabel = analysis.primaryMarker.key === "nonHdl"
    ? '<a class="inline-anchor" href="#primary-marker-rationale">Non-HDL-C*</a>'
    : analysis.primaryMarker.label;

  summaryCard.classList.remove("empty-state");
  summaryCard.innerHTML = `
    <h3>${analysis.riskCategory} risk profile</h3>
    <p>FRS: ${frsText}</p>
    <p>Preferred CCS marker: ${markerLabel} (${markerValue})</p>
    <p>Statin recommendation: ${analysis.statinAnswer}</p>
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

let analyzeTimer = null;

function scheduleAnalyze() {
  window.clearTimeout(analyzeTimer);
  analyzeTimer = window.setTimeout(() => {
    if (!labInput.value.trim() && !document.querySelector("#frs-input").value && !summaryOutput.value.trim()) {
      return;
    }
    analyze();
  }, 60);
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
  renderDecisionAid(buildDecisionAidEstimate(inputs, panel));
  summaryOutput.value = buildSummaryText(analysis, inputs);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze();
});

form.addEventListener("change", () => {
  scheduleAnalyze();
});

treatmentInputs.forEach((input) => {
  input.addEventListener("change", () => {
    scheduleAnalyze();
  });
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

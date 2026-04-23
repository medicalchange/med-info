const logic = window.OsteoporosisRiskLogic;
const form = document.querySelector("#osteo-form");
const bmdInput = document.querySelector("#bmd-input");
const parseFeedback = document.querySelector("#parse-feedback");
const resultCard = document.querySelector("#result-card");
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const resultSubtitle = document.querySelector("#result-subtitle");
const metricsNode = document.querySelector("#metrics");
const recommendationsNode = document.querySelector("#recommendations");
const rationaleNode = document.querySelector("#rationale");
const summaryOutput = document.querySelector("#summary-output");
const loadSampleButton = document.querySelector("#load-sample");
const clearFormButton = document.querySelector("#clear-form");
const copySummaryButton = document.querySelector("#copy-summary");

const fieldMap = {
  age: "#age",
  sex: "#sex",
  bodySize: "#body-size",
  fnTScore: "#fn-tscore",
  hipTScore: "#hip-tscore",
  spineTScore: "#spine-tscore",
  fnBmd: "#fn-bmd",
  majorRisk: "#major-risk",
  hipRisk: "#hip-risk",
};

function setFieldValue(key, value) {
  if (value == null || value === "") return;
  const node = document.querySelector(fieldMap[key]);
  if (!node || node.value) return;
  node.value = value;
}

function formatValue(value, suffix = "") {
  return value == null ? "Not entered" : `${value}${suffix}`;
}

function getInputs() {
  const formData = new FormData(form);
  return {
    age: formData.get("age"),
    sex: formData.get("sex"),
    postmenopausal: formData.get("postmenopausal"),
    fnTScore: formData.get("fnTScore"),
    hipTScore: formData.get("hipTScore"),
    spineTScore: formData.get("spineTScore"),
    fnBmd: formData.get("fnBmd"),
    majorRisk: formData.get("majorRisk"),
    hipRisk: formData.get("hipRisk"),
    priorHip: formData.get("priorHip") === "on",
    priorVertebral: formData.get("priorVertebral") === "on",
    multipleFractures: formData.get("multipleFractures") === "on",
    recentFracture: formData.get("recentFracture") === "on",
    severeVertebral: formData.get("severeVertebral") === "on",
    secondaryCause: formData.get("secondaryCause") === "on",
    recurrentFalls: formData.get("recurrentFalls") === "on",
  };
}

function applyParsedValues() {
  const parsed = logic.parseBmdReport(bmdInput.value);
  Object.entries(parsed).forEach(([key, value]) => setFieldValue(key, value));

  const found = Object.entries(parsed)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${key}: ${value}`);

  parseFeedback.className = "parse-feedback";
  if (!bmdInput.value.trim()) {
    parseFeedback.classList.add("parse-feedback-neutral");
    parseFeedback.textContent = "Paste BMD text to confirm what was parsed.";
  } else if (!found.length) {
    parseFeedback.classList.add("parse-feedback-warning");
    parseFeedback.textContent = "No standard BMD/FRAX values were parsed yet. You can still enter values manually.";
  } else {
    parseFeedback.classList.add("parse-feedback-good");
    parseFeedback.textContent = `Parsed ${found.length} item${found.length === 1 ? "" : "s"}: ${found.slice(0, 5).join(", ")}${found.length > 5 ? "..." : ""}.`;
  }
}

function renderList(items, fallback) {
  if (!items.length) return `<p class="empty-state">${fallback}</p>`;
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderMetrics(assessment) {
  const metrics = [
    ["Major fracture risk", assessment.majorRisk == null ? "Not entered" : `${assessment.majorRisk.toFixed(1)}%`],
    ["Hip fracture risk", assessment.hipRisk == null ? "Not entered" : `${assessment.hipRisk.toFixed(1)}%`],
    ["Lowest T-score", assessment.lowestTScore == null ? "Not entered" : assessment.lowestTScore.toFixed(1)],
    ["Femoral neck T-score", assessment.fnTScore == null ? "Not entered" : assessment.fnTScore.toFixed(1)],
    ["Total hip T-score", assessment.hipTScore == null ? "Not entered" : assessment.hipTScore.toFixed(1)],
    ["Lumbar spine T-score", assessment.spineTScore == null ? "Not entered" : assessment.spineTScore.toFixed(1)],
    ["Femoral neck BMD", assessment.fnBmd == null ? "Not entered" : assessment.fnBmd.toFixed(3)],
  ];

  metricsNode.className = "metrics";
  metricsNode.innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function buildSummary(assessment, inputs) {
  const triggers = [...assessment.highTriggers, ...assessment.moderateTriggers];
  return [
    `Osteoporosis risk helper`,
    `Age/sex: ${inputs.age || "not entered"} / ${inputs.sex || "not entered"}`,
    `FRAX major/hip: ${assessment.majorRisk == null ? "not entered" : `${assessment.majorRisk.toFixed(1)}%`} / ${assessment.hipRisk == null ? "not entered" : `${assessment.hipRisk.toFixed(1)}%`}`,
    `Lowest T-score: ${assessment.lowestTScore == null ? "not entered" : assessment.lowestTScore.toFixed(1)}`,
    `Recommendation: ${assessment.title}`,
    `Basis: ${triggers.length ? triggers.join("; ") : "No encoded treatment threshold met or incomplete FRAX data."}`,
  ].join("\n");
}

function render() {
  const inputs = getInputs();
  const assessment = logic.buildAssessment(inputs);

  resultCard.className = `result-card result-${assessment.category}`;
  resultKicker.textContent = assessment.category === "recommend" ? "High benefit threshold" : assessment.category === "suggest" ? "Intermediate benefit threshold" : assessment.category === "no-routine-treatment" ? "Below treatment threshold" : "Incomplete";
  resultTitle.textContent = assessment.title;
  resultSubtitle.textContent = assessment.subtitle;

  renderMetrics(assessment);

  const nextSteps = [assessment.recommendation, ...assessment.reassessment];
  recommendationsNode.className = "recommendations";
  recommendationsNode.innerHTML = renderList(nextSteps, "Enter risk values to generate a recommendation.");

  const rationale = [];
  rationale.push(`<strong>High-risk treatment triggers checked:</strong> ${assessment.highTriggers.length ? assessment.highTriggers.join("; ") : "none met"}.`);
  rationale.push(`<strong>Intermediate-risk treatment triggers checked:</strong> ${assessment.moderateTriggers.length ? assessment.moderateTriggers.join("; ") : "none met"}.`);
  if (assessment.imagingTriggers.length) rationale.push(`<strong>Consider lateral spine imaging:</strong> ${assessment.imagingTriggers.join("; ")}.`);
  if (assessment.caveats.length) rationale.push(`<strong>Caveats:</strong> ${assessment.caveats.join(" ")}`);
  rationale.push("FRAX/CAROC may underestimate risk with fracture recency, recurrent falls, other comorbidities, or very low lumbar spine/total hip BMD.");
  rationaleNode.className = "rationale";
  rationaleNode.innerHTML = renderList(rationale, "No rationale yet.");

  summaryOutput.value = buildSummary(assessment, inputs);
}

bmdInput.addEventListener("input", () => {
  applyParsedValues();
  render();
});
form.addEventListener("input", render);

loadSampleButton.addEventListener("click", () => {
  form.reset();
  bmdInput.value = logic.SAMPLE_BMD;
  applyParsedValues();
  render();
});

clearFormButton.addEventListener("click", () => {
  form.reset();
  bmdInput.value = "";
  applyParsedValues();
  render();
});

copySummaryButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(summaryOutput.value);
    copySummaryButton.textContent = "Copied";
    setTimeout(() => { copySummaryButton.textContent = "Copy summary"; }, 1200);
  } catch {
    summaryOutput.select();
    document.execCommand("copy");
  }
});

applyParsedValues();
render();

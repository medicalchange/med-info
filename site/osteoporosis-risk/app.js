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
const calculateFraxButton = document.querySelector("#calculate-frax");
const fraxStatus = document.querySelector("#frax-status");
const majorRiskInput = document.querySelector("#major-risk");
const hipRiskInput = document.querySelector("#hip-risk");

const fieldMap = {
  age: "#age",
  sex: "#sex",
  heightCm: "#height-cm",
  weightKg: "#weight-kg",
  fnTScore: "#fn-tscore",
  hipTScore: "#hip-tscore",
  spineTScore: "#spine-tscore",
  fnBmd: "#fn-bmd",
  majorRisk: "#major-risk",
  hipRisk: "#hip-risk",
};

function setFieldValue(key, value) {
  if (!fieldMap[key]) return;
  const node = document.querySelector(fieldMap[key]);
  if (!node) return;
  node.value = value == null ? "" : value;
}

let inputRevision = 0;
let calculatedFrax = false;

function resetForReport(text) {
  inputRevision += 1;
  calculatedFrax = false;
  form.reset();
  bmdInput.value = text;
  setFraxStatus("Review this report's values and clinical history before calculating FRAX.");
  applyParsedValues();
  render();
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
    weightKg: formData.get("weightKg"),
    heightCm: formData.get("heightCm"),
    fraxPreviousFracture: formData.get("fraxPreviousFracture") === "on",
    fraxParentHip: formData.get("fraxParentHip") === "on",
    fraxSmoker: formData.get("fraxSmoker") === "on",
    fraxGlucocorticoids: formData.get("fraxGlucocorticoids") === "on",
    fraxRa: formData.get("fraxRa") === "on",
    fraxSecondaryOsteoporosis: formData.get("fraxSecondaryOsteoporosis") === "on",
    fraxAlcohol: formData.get("fraxAlcohol") === "on",
    priorHip: formData.get("priorHip") === "on",
    priorVertebral: formData.get("priorVertebral") === "on",
    multipleFractures: formData.get("multipleFractures") === "on",
    recentFracture: formData.get("recentFracture") === "on",
    severeVertebral: formData.get("severeVertebral") === "on",
    secondaryCause: formData.get("secondaryCause") === "on",
    recurrentFalls: formData.get("recurrentFalls") === "on",
    contextReviewed: formData.get("contextReviewed") === "on",
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

function setFraxStatus(message, tone = "neutral") {
  fraxStatus.textContent = message;
  fraxStatus.className = `field-note frax-status frax-status-${tone}`;
}

function buildFraxParams(inputs) {
  const age = logic.parseNumber(inputs.age);
  const weight = logic.parseNumber(inputs.weightKg);
  const height = logic.parseNumber(inputs.heightCm);
  const fnTScore = logic.parseNumber(inputs.fnTScore);

  const missing = [];
  if (age == null) missing.push("age");
  if (!inputs.sex) missing.push("sex");
  if (weight == null) missing.push("weight");
  if (height == null) missing.push("height");

  if (missing.length) {
    return { ok: false, message: `Need ${missing.join(", ")} before calculating FRAX.` };
  }

  if (!form.checkValidity() || age < 40 || age > 90 || weight <= 0 || height <= 0) {
    return { ok: false, message: "Check the entered values. FRAX requires age 40–90 and valid height and weight." };
  }

  return {
    ok: true,
    params: {
      age: String(age),
      sex: inputs.sex,
      weight: String(weight),
      height: String(height),
      previousfracture: inputs.fraxPreviousFracture ? "1" : "0",
      pfracturehip: inputs.fraxParentHip ? "1" : "0",
      currentsmoker: inputs.fraxSmoker ? "1" : "0",
      glucocorticoids: inputs.fraxGlucocorticoids ? "1" : "0",
      arthritis: inputs.fraxRa ? "1" : "0",
      osteoporosis: inputs.fraxSecondaryOsteoporosis ? "1" : "0",
      alcohol: inputs.fraxAlcohol ? "1" : "0",
      bmd: fnTScore == null ? "N/A" : "1",
      score: fnTScore == null ? "" : String(fnTScore),
    },
  };
}

async function calculateFrax() {
  const inputs = getInputs();
  const built = buildFraxParams(inputs);
  if (!built.ok) {
    setFraxStatus(built.message, "warning");
    return;
  }

  const query = new URLSearchParams(built.params);
  const revision = inputRevision;
  setFraxStatus("Calculating FRAX...", "neutral");
  calculateFraxButton.disabled = true;

  try {
    const response = await fetch(`/api/frax?${query.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (revision !== inputRevision) return;
    if (!response.ok || !payload) {
      throw new Error(payload?.error || `FRAX proxy returned ${response.status}`);
    }

    if (![payload.majorRisk, payload.hipRisk].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) || payload.hipRisk > payload.majorRisk) {
      throw new Error("Invalid fracture probabilities returned");
    }

    majorRiskInput.value = Number(payload.majorRisk).toFixed(2);
    hipRiskInput.value = Number(payload.hipRisk).toFixed(2);
    calculatedFrax = true;
    setFraxStatus(`FRAX calculated: major ${majorRiskInput.value}%, hip ${hipRiskInput.value}%.`, "good");
    render();
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (revision !== inputRevision) return;
    setFraxStatus(`Could not calculate FRAX yet: ${error.message}. Manual entry still works.`, "warning");
  } finally {
    calculateFraxButton.disabled = false;
  }
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
    `Assessment: ${assessment.recommendation}`,
    `Caveats: ${assessment.caveats.join(" ") || "None recorded."}`,
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
  resetForReport(bmdInput.value);
});
form.addEventListener("input", (event) => {
  if (event.target === bmdInput) return;
  inputRevision += 1;
  const riskFactors = ["age", "sex", "weightKg", "heightCm", "fnTScore", "fraxPreviousFracture", "fraxParentHip", "fraxSmoker", "fraxGlucocorticoids", "fraxRa", "fraxSecondaryOsteoporosis", "fraxAlcohol"];
  if (riskFactors.includes(event.target.name)) {
    majorRiskInput.value = "";
    hipRiskInput.value = "";
    calculatedFrax = false;
    setFraxStatus("FRAX inputs changed. Recalculate or enter verified probabilities.", "warning");
  }
  render();
});

loadSampleButton.addEventListener("click", () => {
  resetForReport(logic.SAMPLE_BMD);
});

clearFormButton.addEventListener("click", () => {
  resetForReport("");
});

calculateFraxButton.addEventListener("click", calculateFrax);

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


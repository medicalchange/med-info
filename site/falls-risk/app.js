const form = document.getElementById("risk-form");
const loadDemoButton = document.getElementById("load-demo");
const statusPill = document.getElementById("status-pill");
const riskFill = document.getElementById("risk-fill");
const riskScore = document.getElementById("risk-score");
const riskProbability = document.getElementById("risk-probability");
const completenessFill = document.getElementById("completeness-fill");
const completenessLabel = document.getElementById("completeness-label");
const driversList = document.getElementById("drivers");
const actionsList = document.getElementById("actions");

const thresholds = {
  community: [
    { max: 29, label: "Low risk", probability: "Indicative 12-month fall probability: under 20%" },
    { max: 54, label: "Moderate risk", probability: "Indicative 12-month fall probability: 20-40%" },
    { max: 74, label: "High risk", probability: "Indicative 12-month fall probability: 40-60%" },
    { max: 100, label: "Very high risk", probability: "Indicative 12-month fall probability: over 60%" }
  ],
  inpatient: [
    { max: 24, label: "Lower inpatient risk", probability: "Indicative in-stay fall risk: lower than unit baseline" },
    { max: 49, label: "Moderate inpatient risk", probability: "Indicative in-stay fall risk: above unit baseline" },
    { max: 72, label: "High inpatient risk", probability: "Indicative in-stay fall risk: clearly elevated" },
    { max: 100, label: "Very high inpatient risk", probability: "Indicative in-stay fall risk: urgent prevention bundle needed" }
  ],
  ltc: [
    { max: 24, label: "Lower residential risk", probability: "Indicative 6-12 month fall risk: lower than facility baseline" },
    { max: 49, label: "Moderate residential risk", probability: "Indicative 6-12 month fall risk: elevated" },
    { max: 72, label: "High residential risk", probability: "Indicative 6-12 month fall risk: high" },
    { max: 100, label: "Very high residential risk", probability: "Indicative 6-12 month fall risk: very high" }
  ]
};

const weights = {
  priorFall: { score: 14, driver: "History of falling remains the strongest single warning sign." },
  recurrentFall: { score: 10, driver: "Recurrent falls signal persistent, unresolved risk." },
  injuriousFall: { score: 8, driver: "An injurious fall raises urgency because future falls have higher consequence." },
  fearOfFalling: { score: 7, driver: "Fear of falling often reflects instability and can worsen deconditioning." },
  balanceProblem: { score: 12, driver: "Balance or gait impairment is a major modifiable driver." },
  mobilityAid: { score: 5, driver: "Mobility-aid use suggests baseline instability or frailty." },
  chairStandDifficulty: { score: 6, driver: "Difficulty rising from a chair points to lower-extremity weakness." },
  lowActivity: { score: 5, driver: "Low activity can amplify weakness and balance decline." },
  dementiaDelirium: { score: 10, driver: "Cognitive impairment or delirium increases supervision and transfer risk." },
  strokeParkinsonism: { score: 9, driver: "Neurologic disease adds fall risk through gait, reflex, and dual-task impairment." },
  orthostasis: { score: 8, driver: "Orthostasis, dizziness, or syncope creates a potentially reversible acute trigger." },
  incontinence: { score: 4, driver: "Urgency and rushing to the toilet can drive time-sensitive falls." },
  visionProblem: { score: 5, driver: "Vision impairment reduces obstacle detection and postural control." },
  footProblem: { score: 4, driver: "Foot and ankle issues reduce ground contact quality and confidence." },
  frailty: { score: 7, driver: "Frailty compounds weakness, slowed reactions, and poor recovery reserve." },
  osteoporosisRisk: { score: 3, driver: "Fragility does not cause falls directly, but it raises harm severity." },
  frids: { score: 7, driver: "Fall-risk-increasing medications create a modifiable pharmacologic burden." },
  polypharmacy: { score: 5, driver: "Polypharmacy correlates with cumulative adverse-effect burden." },
  sedatives: { score: 7, driver: "Sedating drugs increase balance and reaction-time impairment." },
  environmentHazard: { score: 6, driver: "Environmental hazards remain a common, actionable contributor." },
  nightToiletRisk: { score: 4, driver: "Night-time transfers combine urgency, darkness, and orthostasis." },
  unsafeFootwear: { score: 3, driver: "Unsafe footwear undermines traction and stability." }
};

function getFormData() {
  return Object.fromEntries(new FormData(form).entries());
}

function isChecked(name) {
  return form.elements[name].checked;
}

function computeScore() {
  const data = getFormData();
  const setting = data.setting || "community";
  let score = setting === "community" ? 8 : setting === "inpatient" ? 14 : 16;
  const drivers = [];
  const actions = new Set();

  Object.entries(weights).forEach(([name, meta]) => {
    if (isChecked(name)) {
      score += meta.score;
      drivers.push({ points: meta.score, text: meta.driver });
    }
  });

  const age = Number(data.age);
  if (!Number.isNaN(age)) {
    if (age >= 85) score += 7;
    else if (age >= 75) score += 4;
    else if (age >= 65) score += 2;
  }

  const tug = Number(data.tug);
  if (!Number.isNaN(tug) && data.tug !== "") {
    if (tug >= 20) {
      score += 10;
      drivers.push({ points: 10, text: "Slow Timed Up and Go suggests meaningful mobility impairment." });
    } else if (tug >= 13.5) {
      score += 6;
      drivers.push({ points: 6, text: "Borderline-slow Timed Up and Go supports elevated mobility risk." });
    }
  }

  const chairStands = Number(data.chairStands);
  if (!Number.isNaN(chairStands) && data.chairStands !== "") {
    if (chairStands <= 7) {
      score += 7;
      drivers.push({ points: 7, text: "Low chair-stand count suggests lower-limb weakness." });
    } else if (chairStands <= 11) {
      score += 4;
      drivers.push({ points: 4, text: "Borderline chair-stand count suggests reduced reserve." });
    }
  }

  if (data.balanceStage === "fail") {
    score += 8;
    drivers.push({ points: 8, text: "Failed static balance testing adds objective balance evidence." });
  } else if (data.balanceStage === "partial") {
    score += 4;
    drivers.push({ points: 4, text: "Partial balance-test performance suggests intermediate instability." });
  }

  if (isChecked("priorFall") || isChecked("recurrentFall") || isChecked("injuriousFall")) {
    actions.add("Review the exact circumstances of prior falls to target the next prevention step.");
  }
  if (isChecked("balanceProblem") || tug >= 13.5 || isChecked("chairStandDifficulty") || chairStands <= 11 || data.balanceStage === "fail") {
    actions.add("Refer for strength, gait, and balance intervention such as PT or a structured exercise program.");
  }
  if (isChecked("frids") || isChecked("polypharmacy") || isChecked("sedatives")) {
    actions.add("Perform a medication review focused on sedatives, psychotropics, antihypertensives, and total drug burden.");
  }
  if (isChecked("orthostasis")) {
    actions.add("Check orthostatic vitals and address dizziness, dehydration, or syncope contributors.");
  }
  if (isChecked("visionProblem")) {
    actions.add("Arrange vision review and address cataract or corrective-lens issues.");
  }
  if (isChecked("environmentHazard") || isChecked("nightToiletRisk") || isChecked("unsafeFootwear")) {
    actions.add("Reduce environmental hazards with lighting, bathroom access, footwear, and transfer-path fixes.");
  }
  if (isChecked("dementiaDelirium")) {
    actions.add("Add supervision and delirium/cognition support rather than relying on a score alone.");
  }
  if (isChecked("frailty") || isChecked("lowActivity")) {
    actions.add("Address deconditioning with progressive activity, nutrition review, and mobility support.");
  }
  if (isChecked("osteoporosisRisk") || isChecked("injuriousFall")) {
    actions.add("Pair fall prevention with fracture-risk and bone-health review because harm reduction matters too.");
  }

  if (setting === "inpatient") {
    actions.add("Use a unit-based prevention bundle: toileting plan, call-light access, mobility supervision, and safe transfers.");
  }
  if (setting === "ltc") {
    actions.add("In residential care, combine routine staff cueing with personalized mobility and toileting plans.");
  }

  const measurableFields = ["tug", "chairStands", "balanceStage"];
  const checkboxFields = Object.keys(weights);
  const completedMeasurements = measurableFields.filter((field) => {
    if (field === "balanceStage") return data[field] !== "";
    return data[field] !== "";
  }).length;
  const completedCheckboxes = checkboxFields.filter((field) => isChecked(field)).length;
  const completeness = Math.round(((completedMeasurements + completedCheckboxes) / (measurableFields.length + 10)) * 100);

  return {
    setting,
    score: Math.max(0, Math.min(100, score)),
    completeness: Math.max(25, Math.min(100, completeness)),
    drivers: drivers.sort((a, b) => b.points - a.points).slice(0, 5),
    actions: Array.from(actions).slice(0, 6)
  };
}

function getRiskBand(setting, score) {
  return thresholds[setting].find((band) => score <= band.max);
}

function render() {
  const result = computeScore();
  const band = getRiskBand(result.setting, result.score);

  statusPill.textContent = band.label;
  riskFill.style.width = `${result.score}%`;
  riskScore.textContent = `${result.score} / 100`;
  riskProbability.textContent = band.probability;

  statusPill.style.background = result.score >= 75
    ? "rgba(180, 61, 54, 0.14)"
    : result.score >= 50
      ? "rgba(195, 98, 43, 0.14)"
      : "rgba(13, 107, 97, 0.12)";
  statusPill.style.color = result.score >= 75
    ? "#8f2a24"
    : result.score >= 50
      ? "#9c531f"
      : "#0d6b61";

  completenessFill.style.width = `${result.completeness}%`;
  completenessLabel.textContent = result.completeness >= 75
    ? "Good"
    : result.completeness >= 50
      ? "Fair"
      : "Low";

  driversList.innerHTML = "";
  if (result.drivers.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No major drivers entered yet. Add history, mobility, and medication data to improve signal.";
    driversList.appendChild(item);
  } else {
    result.drivers.forEach((driver) => {
      const item = document.createElement("li");
      item.textContent = driver.text;
      driversList.appendChild(item);
    });
  }

  actionsList.innerHTML = "";
  result.actions.forEach((action) => {
    const item = document.createElement("li");
    item.textContent = action;
    actionsList.appendChild(item);
  });
}

function loadDemo() {
  form.reset();
  form.elements.setting.value = "community";
  form.elements.age.value = "84";
  form.elements.priorFall.checked = true;
  form.elements.recurrentFall.checked = true;
  form.elements.injuriousFall.checked = true;
  form.elements.fearOfFalling.checked = true;
  form.elements.balanceProblem.checked = true;
  form.elements.mobilityAid.checked = true;
  form.elements.chairStandDifficulty.checked = true;
  form.elements.lowActivity.checked = true;
  form.elements.dementiaDelirium.checked = false;
  form.elements.strokeParkinsonism.checked = true;
  form.elements.orthostasis.checked = true;
  form.elements.incontinence.checked = true;
  form.elements.visionProblem.checked = true;
  form.elements.footProblem.checked = true;
  form.elements.frailty.checked = true;
  form.elements.osteoporosisRisk.checked = true;
  form.elements.frids.checked = true;
  form.elements.polypharmacy.checked = true;
  form.elements.sedatives.checked = true;
  form.elements.environmentHazard.checked = true;
  form.elements.nightToiletRisk.checked = true;
  form.elements.unsafeFootwear.checked = false;
  form.elements.tug.value = "18.2";
  form.elements.chairStands.value = "6";
  form.elements.balanceStage.value = "fail";
  render();
}

form.addEventListener("input", render);
loadDemoButton.addEventListener("click", loadDemo);
render();

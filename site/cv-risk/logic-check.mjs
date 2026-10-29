import fs from "fs";
import vm from "vm";

const code = fs.readFileSync(new URL("./logic.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(code, context);

const { buildAnalysis, parseLipidPanel } = context.window.CVRiskLogic;

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function analyze(panelText, inputs) {
  return buildAnalysis({ panel: parseLipidPanel(panelText), inputs });
}

const basePanel = `CHOL 5.40
TG 0.96
HDL 1.81
LDL 3.20
NON-HDL 3.59
CHOL/HDL 3.0`;
const highPanel = `CHOL 7.20
TG 2.20
HDL 1.00
LDL 5.40
NON-HDL 6.20
CHOL/HDL 7.2`;

const cases = [
  {
    name: "low-risk no exception",
    analysis: analyze(basePanel, { frs: "5", therapy: "none" }),
    check(analysis) {
      expect(analysis.statinAnswer === "Usually no", "Expected low-risk case to stay Usually no");
      expect(analysis.followupTests.some((item) => item.title === "Repeat lipid screening and risk assessment"), "Expected primary-prevention follow-up interval");
    },
  },
  {
    name: "intermediate age trigger",
    analysis: analyze(basePanel, { frs: "12", age: "55", sex: "male", therapy: "none", additionalRiskFactor: true }),
    check(analysis) {
      expect(analysis.statinAnswer === "Consider", "Expected intermediate age-trigger case to be Consider");
      expect(analysis.triggerSummary.includes("man age 55"), "Expected trigger summary to mention age-trigger pathway");
      expect(analysis.clarifyTests.some((item) => item.title === "Coronary artery calcium (CAC) score"), "Expected CAC clarification option");
    },
  },
  {
    name: "diabetes narrows ACR",
    analysis: analyze(basePanel, { frs: "8", diabetes: true, therapy: "none" }),
    check(analysis) {
      expect(analysis.clarifyTests.some((item) => item.title === "Urine albumin-to-creatinine ratio (ACR)"), "Expected ACR for diabetes case");
    },
  },
  {
    name: "additional risk factor alone does not add ACR",
    analysis: analyze(basePanel, { frs: "12", age: "55", sex: "male", therapy: "none", additionalRiskFactor: true }),
    check(analysis) {
      expect(!analysis.clarifyTests.some((item) => item.title === "Urine albumin-to-creatinine ratio (ACR)"), "Did not expect ACR from broad additional risk factor alone");
    },
  },
  {
    name: "very high LDL statin-indicated",
    analysis: analyze(highPanel, { frs: "12", therapy: "none" }),
    check(analysis) {
      expect(analysis.statinAnswer === "Yes", "Expected very high LDL case to be statin-indicated");
      expect(analysis.triggerSummary.includes("LDL-C 5.40 mmol/L"), "Expected trigger summary to include LDL threshold");
      expect(analysis.clarifyTests.some((item) => item.title === "Familial hypercholesterolemia / genetic dyslipidemia assessment"), "Expected FH assessment suggestion");
    },
  },
  {
    name: "high FRS does not get routine 5-year screening follow-up",
    analysis: analyze(basePanel, { frs: "25", therapy: "none" }),
    check(analysis) {
      expect(analysis.statinAnswer === "Yes", "Expected high FRS case to be statin eligible");
      expect(!analysis.followupTests.some((item) => item.title === "Repeat lipid screening and risk assessment"), "Did not expect routine 5-year follow-up for a treatment-now high-risk case");
    },
  },
  {
    name: "diabetes alone does not trigger icosapent option",
    analysis: buildAnalysis({ panel: { totalChol: 5.4, tg: 2.0, hdl: 1.3, ldl: 3.0, nonHdl: 4.1 }, inputs: { frs: "8", therapy: "statin", diabetes: true } }),
    check(analysis) {
      expect(!analysis.recommendations.some((item) => item.title === "Triglyceride-based add-on option"), "Did not expect icosapent recommendation for diabetes alone");
    },
  },
  {
    name: "diabetes plus added risk can trigger icosapent option",
    analysis: buildAnalysis({ panel: { totalChol: 5.4, tg: 2.0, hdl: 1.3, ldl: 3.0, nonHdl: 4.1 }, inputs: { frs: "8", therapy: "statin", diabetes: true, diabetesAdditionalRisk: true } }),
    check(analysis) {
      expect(analysis.recommendations.some((item) => item.title === "Triglyceride-based add-on option"), "Expected icosapent recommendation when diabetes plus additional CV risk is entered");
    },
  },
  {
    name: "untreated ASCVD uses ASCVD intensification thresholds",
    analysis: analyze(basePanel, { therapy: "none", ascvd: true }),
    check(analysis) {
      const targetCard = analysis.recommendations.find((item) => item.title === "Initial treatment target");
      expect(targetCard && targetCard.body.includes("LDL-C remains ≥1.8 mmol/L"), "Expected untreated ASCVD target card to reference ASCVD thresholds");
    },
  },
  {
    name: "Lp(a) 80 nmol/L is below the CCS modifier threshold",
    analysis: analyze(basePanel, { frs: "12", therapy: "none", lpa: "80", lpaUnit: "nmol/L" }),
    check(analysis) {
      expect(!analysis.riskModifierPresent, "Did not expect Lp(a) 80 nmol/L to count as a risk modifier");
      expect(analysis.statinAnswer === "Not clearly indicated", "Expected no intermediate-risk trigger from Lp(a) 80 nmol/L");
    },
  },
  {
    name: "Lp(a) 120 nmol/L is a CCS risk modifier",
    analysis: analyze(basePanel, { frs: "12", therapy: "none", lpa: "120", lpaUnit: "nmol/L" }),
    check(analysis) {
      expect(analysis.riskModifierPresent, "Expected Lp(a) 120 nmol/L to count as a risk modifier");
      expect(analysis.triggerSummary.includes("Lp(a) 120 nmol/L"), "Expected trigger summary to show the nmol/L unit");
    },
  },
  {
    name: "Lp(a) 60 mg/dL is a CCS risk modifier",
    analysis: analyze(basePanel, { frs: "12", therapy: "none", lpa: "60", lpaUnit: "mg/dL" }),
    check(analysis) {
      expect(analysis.riskModifierPresent, "Expected Lp(a) 60 mg/dL to count as a risk modifier");
    },
  },
  {
    name: "low HDL in a woman triggers the older-age pathway",
    analysis: buildAnalysis({ panel: { totalChol: 5.0, tg: 1.0, hdl: 1.2, ldl: 3.0, nonHdl: 3.8 }, inputs: { frs: "12", age: "62", sex: "female", therapy: "none" } }),
    check(analysis) {
      expect(analysis.ageTrigger, "Expected HDL 1.2 in a woman to count as an added risk factor");
      expect(analysis.statinAnswer === "Consider", "Expected low-HDL age trigger to support a statin discussion");
      expect(analysis.triggerSummary.includes("low HDL-C"), "Expected trigger summary to name low HDL-C");
    },
  },
  {
    name: "HDL 1.2 in a man is not low",
    analysis: buildAnalysis({ panel: { totalChol: 5.0, tg: 1.0, hdl: 1.2, ldl: 3.0, nonHdl: 3.8 }, inputs: { frs: "12", age: "55", sex: "male", therapy: "none" } }),
    check(analysis) {
      expect(!analysis.ageTrigger, "Did not expect HDL 1.2 in a man to count as low HDL-C");
    },
  },
  {
    name: "high FRS on statin gets the add-on check",
    analysis: buildAnalysis({ panel: { totalChol: 4.5, tg: 1.0, hdl: 1.3, ldl: 2.4, nonHdl: 3.2 }, inputs: { frs: "22", therapy: "statin" } }),
    check(analysis) {
      expect(analysis.recommendations.some((item) => item.title === "Add-on threshold met"), "Expected add-on threshold for FRS-based statin patient with LDL 2.4");
    },
  },
  {
    name: "high FRS on statin below add-on threshold",
    analysis: buildAnalysis({ panel: { totalChol: 3.8, tg: 1.0, hdl: 1.3, ldl: 1.9, nonHdl: 2.5 }, inputs: { frs: "22", therapy: "statin" } }),
    check(analysis) {
      expect(analysis.recommendations.some((item) => item.title === "At or below common add-on threshold"), "Expected below-threshold card for LDL 1.9");
    },
  },
  {
    name: "ASCVD on statin + ezetimibe with LDL 2.0 meets PCSK9 threshold",
    analysis: buildAnalysis({ panel: { totalChol: 3.9, tg: 1.0, hdl: 1.3, ldl: 2.0, nonHdl: 2.6 }, inputs: { therapy: "statin-ezetimibe", ascvd: true } }),
    check(analysis) {
      expect(analysis.recommendations.some((item) => item.title === "Persistent ASCVD elevation despite statin + ezetimibe"), "Expected PCSK9 recommendation at LDL 2.0 (CCS threshold is >=1.8)");
    },
  },
  {
    name: "ASCVD on statin + ezetimibe with LDL 1.6 is below threshold",
    analysis: buildAnalysis({ panel: { totalChol: 3.4, tg: 1.0, hdl: 1.3, ldl: 1.6, nonHdl: 2.1 }, inputs: { therapy: "statin-ezetimibe", ascvd: true } }),
    check(analysis) {
      expect(!analysis.recommendations.some((item) => item.title === "Persistent ASCVD elevation despite statin + ezetimibe"), "Did not expect PCSK9 recommendation at LDL 1.6");
    },
  },
];

for (const testCase of cases) {
  testCase.check(testCase.analysis);
}

console.log(`Passed ${cases.length} cv-risk logic checks.`);

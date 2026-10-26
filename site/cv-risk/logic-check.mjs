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
];

for (const testCase of cases) {
  testCase.check(testCase.analysis);
}

console.log(`Passed ${cases.length} cv-risk logic checks.`);

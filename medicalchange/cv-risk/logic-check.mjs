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
];

for (const testCase of cases) {
  testCase.check(testCase.analysis);
}

console.log(`Passed ${cases.length} cv-risk logic checks.`);

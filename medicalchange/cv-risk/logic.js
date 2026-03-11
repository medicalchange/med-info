window.CVRiskLogic = (() => {
const FIELD_DEFINITIONS = [
  { key: "ratio", label: "Chol/HDL ratio", pattern: /^(?:CHOL\/HDL|TC\/HDL|TOTAL CHOL\/HDL)\b/i },
  { key: "totalChol", label: "Total cholesterol", pattern: /^(?:CHOL|CHOLESTEROL|TOTAL CHOL(?:ESTEROL)?|TOTAL CHOLESTEROL)\b(?!\s*\/)/i },
  { key: "tg", label: "Triglycerides", pattern: /^(?:TG|TRIGLYCERIDES?)\b/i },
  { key: "hdl", label: "HDL-C", pattern: /^(?:HDL|HDL-C)\b/i },
  { key: "ldl", label: "LDL-C", pattern: /^(?:LDL|LDL-C)\b/i },
  { key: "nonHdl", label: "Non-HDL-C", pattern: /^(?:NON[- ]?HDL|NON[- ]?HDL-C)\b/i },
];

const SAMPLE_PANEL = `CHOL                                            5.40               <=5.19
Total cholesterol and HDL-C used
for risk assessment and to calculate non-HDL-C.
TG                                              0.96               <=1.69
If nonfasting,
triglycerides <2.00 mmol/L desired.
HDL                                             1.81               1.00 - 9999.00
M: >=1.00 mmol/L
HDL-C <1.00 mmol/L indicates risk for metabolic syndrome.
LDL                                             3.20               <=3.49
LDL-C was calculated using the
NIH equation.
For additional LDL-C and non-HDL-C thresholds
based on risk stratification,
refer to 2021 CCS Guidelines.
NON-HDL                                         3.59               <=4.19
CHOL/HDL                                        3.0`;

function parseNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractValueFromLine(line) {
  const match = line.match(/-?\d+(?:[.,]\d+)?/);
  return match ? parseNumber(match[0]) : null;
}

function formatNumber(value, digits = 2) {
  return value == null ? null : Number(value).toFixed(digits);
}

function parseLipidPanel(rawText) {
  const text = String(rawText ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const panel = {};

  for (const line of lines) {
    for (const field of FIELD_DEFINITIONS) {
      if (panel[field.key] != null) {
        continue;
      }

      if (!field.pattern.test(line)) {
        continue;
      }

      const remainder = line.replace(field.pattern, "").trim();
      const value = extractValueFromLine(remainder) ?? extractValueFromLine(line);
      if (value != null) {
        panel[field.key] = value;
      }
    }
  }

  if (panel.nonHdl == null && panel.totalChol != null && panel.hdl != null) {
    panel.nonHdl = Number((panel.totalChol - panel.hdl).toFixed(2));
  }

  return panel;
}

function buildRiskCategory(frs) {
  if (frs == null) {
    return "Unknown";
  }
  if (frs >= 20) {
    return "High";
  }
  if (frs >= 10) {
    return "Intermediate";
  }
  return "Low";
}

function getPrimaryMarker(panel) {
  if (panel.tg != null && panel.tg > 1.5) {
    return {
      key: "nonHdl",
      label: "Non-HDL-C",
      value: panel.nonHdl,
      reason: "TG is >1.5 mmol/L, so CCS prefers non-HDL-C or ApoB over LDL-C for screening.",
    };
  }

  return {
    key: "ldl",
    label: "LDL-C",
    value: panel.ldl,
    reason: "TG is not >1.5 mmol/L, so LDL-C remains the main threshold marker.",
  };
}

function countAdditionalRiskFactors(flags) {
  return flags.additionalRiskFactor ? 1 : 0;
}

function buildAgeTrigger(age, sex, additionalRiskFactorCount) {
  if (age == null || !sex || additionalRiskFactorCount === 0) {
    return false;
  }

  if (sex === "male" && age >= 50) {
    return true;
  }

  if (sex === "female" && age >= 60) {
    return true;
  }

  return false;
}

function addRecommendation(collection, tone, title, body) {
  collection.push({ tone, title, body });
}

function addRationale(collection, title, body) {
  collection.push({ title, body });
}

function addTest(collection, title, timing, body) {
  collection.push({ title, timing, body });
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildTriggerSummary(parts, fallback = "No specific CCS trigger identified.") {
  const compact = uniqueItems(parts);
  if (!compact.length) {
    return fallback;
  }
  return compact.join(" + ");
}

function describeThreshold(triggerText, contextLabel) {
  if (!triggerText) {
    return contextLabel;
  }

  if (triggerText.startsWith("LDL-C ")) {
    return `${contextLabel} because LDL-C is above the CCS threshold (${triggerText} >= 3.5 mmol/L).`;
  }

  if (triggerText.startsWith("non-HDL-C ")) {
    return `${contextLabel} because non-HDL-C is above the CCS threshold (${triggerText} >= 4.2 mmol/L).`;
  }

  if (triggerText.startsWith("ApoB ")) {
    return `${contextLabel} because ApoB is above the CCS threshold (${triggerText} >= 1.05 g/L).`;
  }

  return `${contextLabel} because ${triggerText} is present.`;
}

function buildThresholdCheckBody(parts, therapy, flags) {
  const thresholds = [
    "statin initiation LDL-C >=3.5 mmol/L, non-HDL-C >=4.2 mmol/L, ApoB >=1.05 g/L",
    "automatic statin-indicated baseline lipid level LDL-C >=5.0 mmol/L, non-HDL-C >=5.8 mmol/L, ApoB >=1.45 g/L",
  ];

  if (therapy === "statin") {
    if (flags.ascvd) {
      thresholds.push("ASCVD intensification on statin LDL-C >=1.8 mmol/L, non-HDL-C >=2.4 mmol/L, ApoB >=0.7 g/L");
    } else {
      thresholds.push("add-on threshold on statin LDL-C >2.0 mmol/L, non-HDL-C >2.6 mmol/L, ApoB >0.8 g/L");
    }
  }

  if (therapy === "statin-ezetimibe" && flags.ascvd) {
    thresholds.push("persistent ASCVD elevation after statin + ezetimibe LDL-C >2.2 mmol/L, non-HDL-C >2.9 mmol/L, ApoB >0.8 g/L");
  }

  return `${parts.join(", ")} were compared with CCS thresholds: ${thresholds.join("; ")}.`;
}

function buildAnalysis({ panel, inputs }) {
  const frs = parseNumber(inputs.frs);
  const apoB = parseNumber(inputs.apoB);
  const lpA = parseNumber(inputs.lpa);
  const age = parseNumber(inputs.age);
  const therapy = inputs.therapy || "none";

  const flags = {
    ascvd: Boolean(inputs.ascvd),
    diabetes: Boolean(inputs.diabetes),
    ckd: Boolean(inputs.ckd),
    familyHistory: Boolean(inputs.familyHistory),
    cac: Boolean(inputs.cac),
    hscrp: Boolean(inputs.hscrp),
    additionalRiskFactor: Boolean(inputs.additionalRiskFactor),
    diabetesAdditionalRisk: Boolean(inputs.diabetesAdditionalRisk),
  };

  const riskCategory = buildRiskCategory(frs);
  const primaryMarker = getPrimaryMarker(panel);
  const additionalRiskFactorCount = countAdditionalRiskFactors(flags);
  const ageTrigger = buildAgeTrigger(age, inputs.sex, additionalRiskFactorCount);
  const riskModifierPresent =
    flags.familyHistory ||
    flags.cac ||
    flags.hscrp ||
    (lpA != null && lpA >= 50);

  const lipidStatinIndicated =
    (panel.ldl != null && panel.ldl >= 5.0) ||
    (panel.nonHdl != null && panel.nonHdl >= 5.8) ||
    (apoB != null && apoB >= 1.45);

  const statinIndicated =
    lipidStatinIndicated ||
    flags.ascvd ||
    flags.diabetes ||
    flags.ckd;

  const intermediateThresholdMet =
    (panel.ldl != null && panel.ldl >= 3.5) ||
    (panel.nonHdl != null && panel.nonHdl >= 4.2) ||
    (apoB != null && apoB >= 1.05);

  const statinConditionTriggers = [];
  if (flags.ascvd) {
    statinConditionTriggers.push("ASCVD / AAA");
  }
  if (flags.diabetes) {
    statinConditionTriggers.push("diabetes meeting CCS criteria");
  }
  if (flags.ckd) {
    statinConditionTriggers.push("CKD meeting CCS criteria");
  }
  if (panel.ldl != null && panel.ldl >= 5.0) {
    statinConditionTriggers.push(`LDL-C ${formatNumber(panel.ldl)} mmol/L`);
  }
  if (panel.nonHdl != null && panel.nonHdl >= 5.8) {
    statinConditionTriggers.push(`non-HDL-C ${formatNumber(panel.nonHdl)} mmol/L`);
  }
  if (apoB != null && apoB >= 1.45) {
    statinConditionTriggers.push(`ApoB ${formatNumber(apoB)} g/L`);
  }

  const thresholdTriggers = [];
  if (panel.ldl != null && panel.ldl >= 3.5) {
    thresholdTriggers.push(`LDL-C ${formatNumber(panel.ldl)} mmol/L`);
  }
  if (panel.nonHdl != null && panel.nonHdl >= 4.2) {
    thresholdTriggers.push(`non-HDL-C ${formatNumber(panel.nonHdl)} mmol/L`);
  }
  if (apoB != null && apoB >= 1.05) {
    thresholdTriggers.push(`ApoB ${formatNumber(apoB)} g/L`);
  }

  const modifierTriggers = [];
  if (flags.familyHistory) {
    modifierTriggers.push("family history of premature CAD");
  }
  if (flags.cac) {
    modifierTriggers.push("CAC > 0 AU");
  }
  if (flags.hscrp) {
    modifierTriggers.push("hsCRP ≥2.0 mg/L");
  }
  if (lpA != null && lpA >= 50) {
    modifierTriggers.push(`Lp(a) ${formatNumber(lpA, 0)} mg/dL`);
  }
  if (ageTrigger) {
    modifierTriggers.push(inputs.sex === "female"
      ? `woman age ${formatNumber(age, 0)} with ≥1 added risk factor`
      : `man age ${formatNumber(age, 0)} with ≥1 added risk factor`);
  }

  const recommendations = [];
  const rationale = [];
  const clarifyTests = [];
  const followupTests = [];
  let statinAnswer = "Insufficient data";
  let statinDecision = "unknown";
  let statinReason = "Need either an FRS or a statin-indicated condition to classify treatment.";
  let triggerSummary = "FRS not entered and no statin-indicated condition selected.";

  if (frs == null && !statinIndicated) {
    addRecommendation(
      recommendations,
      "caution",
      "FRS missing",
      "Enter the Framingham Risk Score to apply the CCS primary-prevention decision thresholds accurately."
    );
  }

  addRationale(
    rationale,
    "Primary lipid marker",
    primaryMarker.reason
  );

  if (panel.ldl != null || panel.nonHdl != null || apoB != null) {
    const parts = [];
    if (panel.ldl != null) {
      parts.push(`LDL-C ${panel.ldl.toFixed(2)} mmol/L`);
    }
    if (panel.nonHdl != null) {
      parts.push(`non-HDL-C ${panel.nonHdl.toFixed(2)} mmol/L`);
    }
    if (apoB != null) {
      parts.push(`ApoB ${apoB.toFixed(2)} g/L`);
    }

    addRationale(
      rationale,
      "Threshold check",
      buildThresholdCheckBody(parts, therapy, flags)
    );
  }

  if (lipidStatinIndicated) {
    addRationale(
      rationale,
      "Automatic statin-indicated lipid level",
      "The pocket guide treats LDL-C ≥5.0 mmol/L, non-HDL-C ≥5.8 mmol/L, or ApoB ≥1.45 g/L as statin-indicated."
    );
  }

  if (statinIndicated) {
    statinAnswer = "Yes";
    statinDecision = "yes";
    statinReason = "A CCS statin-indicated condition is present from ASCVD, diabetes, CKD, or markedly elevated baseline lipids.";
    triggerSummary = buildTriggerSummary(statinConditionTriggers);
    addRecommendation(
      recommendations,
      "alert",
      "Statin-indicated condition present",
      "Statin therapy is indicated for ASCVD, diabetes meeting CCS criteria, CKD meeting CCS criteria, or very high baseline LDL-C/non-HDL-C/ApoB."
    );

    if (therapy === "none") {
      addRecommendation(
        recommendations,
        "alert",
        "Initial treatment target",
        flags.ascvd
          ? "Discuss starting maximally tolerated statin therapy plus health-behaviour modification. In ASCVD, add-on treatment should be considered if LDL-C remains ≥1.8 mmol/L, non-HDL-C ≥2.4 mmol/L, or ApoB ≥0.7 g/L on statin therapy."
          : "Discuss starting statin therapy plus health-behaviour modification. After statin initiation, the usual non-ASCVD add-on threshold is LDL-C >2.0 mmol/L, non-HDL-C >2.6 mmol/L, or ApoB >0.8 g/L."
      );
    }

    if (therapy === "statin") {
      if (
        flags.ascvd &&
        ((panel.ldl != null && panel.ldl >= 1.8) ||
          (panel.nonHdl != null && panel.nonHdl >= 2.4) ||
          (apoB != null && apoB >= 0.7))
      ) {
        addRecommendation(
          recommendations,
          "alert",
          "ASCVD on statin: intensification threshold met",
          "With ASCVD on maximally tolerated statin therapy, add-on treatment should be considered once LDL-C is ≥1.8 mmol/L, non-HDL-C is ≥2.4 mmol/L, or ApoB is ≥0.7 g/L."
        );
      } else if (
        !flags.ascvd &&
        ((panel.ldl != null && panel.ldl > 2.0) ||
          (panel.nonHdl != null && panel.nonHdl > 2.6) ||
          (apoB != null && apoB > 0.8))
      ) {
        addRecommendation(
          recommendations,
          "caution",
          "Add-on threshold met",
          "For statin-indicated conditions without ASCVD, consider ezetimibe when LDL-C remains >2.0 mmol/L, non-HDL-C remains >2.6 mmol/L, or ApoB remains >0.8 g/L on a maximally tolerated statin."
        );
      } else {
        addRecommendation(
          recommendations,
          "good",
          "At or below common add-on threshold",
          "Current lipids do not cross the usual add-on threshold for a statin-indicated condition based on the entered values."
        );
      }
    }

    if (
      therapy === "statin-ezetimibe" &&
      flags.ascvd &&
      ((panel.ldl != null && panel.ldl > 2.2) ||
        (panel.nonHdl != null && panel.nonHdl > 2.9) ||
        (apoB != null && apoB > 0.8))
    ) {
      addRecommendation(
        recommendations,
        "alert",
        "Persistent ASCVD elevation despite statin + ezetimibe",
        "In ASCVD, PCSK9 therapy should be discussed when LDL-C remains above about 2.2 mmol/L, non-HDL-C above 2.9 mmol/L, or ApoB above 0.8 g/L despite statin plus ezetimibe."
      );
    }
  } else if (frs != null) {
    if (frs >= 20) {
      statinAnswer = "Yes";
      statinDecision = "yes";
      statinReason = "FRS is 20% or higher, which CCS treats as high risk and statin eligible.";
      triggerSummary = `FRS ${formatNumber(frs, 1)}%`;
      addRecommendation(
        recommendations,
        "alert",
        "High FRS",
        "At FRS ≥20%, statin therapy and lifestyle treatment are indicated."
      );
    } else if (frs >= 10) {
      if (intermediateThresholdMet || ageTrigger || riskModifierPresent) {
        statinAnswer = "Consider";
        statinDecision = "consider";
        const primaryIntermediateReason = thresholdTriggers[0]
          || (ageTrigger ? modifierTriggers.find((item) => item.includes("age")) : null)
          || modifierTriggers[0];
        statinReason = describeThreshold(
          primaryIntermediateReason,
          "FRS is 10% to 19.9%"
        );
        triggerSummary = buildTriggerSummary([
          `FRS ${formatNumber(frs, 1)}%`,
          thresholdTriggers[0],
          ageTrigger ? modifierTriggers.find((item) => item.includes('age')) : null,
          !ageTrigger ? modifierTriggers[0] : null,
        ]);
        addRecommendation(
          recommendations,
          "caution",
          "Intermediate-risk statin discussion supported",
          `At FRS 10% to 19.9%, statin therapy is supported here because ${primaryIntermediateReason || "a qualifying intermediate-risk factor"} is present.`
        );
      } else {
        statinAnswer = "Not clearly indicated";
        statinDecision = "no";
        statinReason = "FRS is 10% to 19.9% but the entered data do not cross a clear CCS lipid or modifier trigger.";
        triggerSummary = `FRS ${formatNumber(frs, 1)}% with no CCS threshold crossed`;
        addRecommendation(
          recommendations,
          "good",
          "Intermediate risk but no clear CCS lipid trigger",
          "At FRS 10% to 19.9%, the entered values do not meet a CCS lipid or modifier threshold for statin treatment."
        );
      }
    } else if (frs >= 5) {
      if (intermediateThresholdMet) {
        statinAnswer = "Consider";
        statinDecision = "consider";
        statinReason = describeThreshold(
          thresholdTriggers[0],
          "FRS is 5% to 9.9%"
        );
        triggerSummary = buildTriggerSummary([`FRS ${formatNumber(frs, 1)}%`, thresholdTriggers[0]]);
        addRecommendation(
          recommendations,
          "caution",
          "Low-risk exception worth discussing",
          `At FRS 5% to 9.9%, statin therapy can be considered here because ${thresholdTriggers[0] || "a qualifying lipid threshold"} is above the low-risk exception threshold.`
        );
      } else {
        statinAnswer = "Usually no";
        statinDecision = "no";
        statinReason = "FRS is below 10% and no separate statin-indicated condition or low-risk exception threshold is present.";
        triggerSummary = `FRS ${formatNumber(frs, 1)}% with no low-risk exception threshold crossed`;
        addRecommendation(
          recommendations,
          "good",
          "No usual statin trigger in low risk",
          "Below 10% FRS, statin therapy is usually not recommended unless a statin-indicated condition or low-risk exception threshold is present."
        );
      }
    } else {
      statinAnswer = "Usually no";
      statinDecision = "no";
      statinReason = "FRS is below 5%, so lifestyle treatment is favored unless another statin-indicated condition exists.";
      triggerSummary = `FRS ${formatNumber(frs, 1)}%`;
      addRecommendation(
        recommendations,
        "good",
        "Very low FRS",
        "Below 5% FRS, lifestyle treatment is favored unless a separate statin-indicated condition is present."
      );
    }
  }

  if (statinDecision === "unknown" && statinIndicated) {
    statinDecision = "yes";
    statinReason = "A statin-indicated condition is present.";
    triggerSummary = buildTriggerSummary(statinConditionTriggers);
  }

  if (
    panel.tg != null &&
    panel.tg >= 1.5 &&
    panel.tg <= 5.6 &&
    therapy !== "none" &&
    (flags.ascvd || (flags.diabetes && flags.diabetesAdditionalRisk))
  ) {
    addRecommendation(
      recommendations,
      "caution",
      "Triglyceride-based add-on option",
      flags.ascvd
        ? "Consider icosapent ethyl if TG is 1.5 to 5.6 mmol/L and the patient has ASCVD despite statin therapy."
        : "Consider icosapent ethyl if TG is 1.5 to 5.6 mmol/L and the patient has diabetes plus additional cardiovascular risk factors despite statin therapy."
    );
  }

  if (panel.tg != null && panel.tg > 4.5) {
    addRecommendation(
      recommendations,
      "caution",
      "High triglycerides",
      "A history of triglycerides above 4.5 mmol/L is a CCS reason to repeat lipid testing fasting."
    );
  }

  if (!recommendations.length) {
    addRecommendation(
      recommendations,
      "caution",
      "Insufficient inputs",
      "The panel was parsed, but there is not enough information to produce a guideline-based recommendation. Check the pasted lab values and FRS."
    );
  }

  if (lpA == null) {
    addTest(
      clarifyTests,
      "Lipoprotein(a)",
      "Once in a lifetime",
      "Measure Lp(a) once as part of lipid screening to improve ASCVD risk assessment. Routine repeat testing is generally not needed."
    );
  } else {
    addTest(
      clarifyTests,
      "Lp(a) already known",
      "No routine repeat",
      "A measured Lp(a) value can be used as a risk modifier. CCS treats this as a once-in-a-lifetime test in most patients."
    );
  }

  if (apoB == null && ((panel.tg != null && panel.tg > 1.5) || (frs != null && frs >= 5))) {
    addTest(
      clarifyTests,
      "ApoB",
      "If decision remains uncertain",
      "CCS allows ApoB as an alternative atherogenic marker, and it becomes especially useful when TG is >1.5 mmol/L or when statin decisions are borderline."
    );
  }

  addTest(
    clarifyTests,
    "Fasting plasma glucose or HbA1c",
    "If not already available",
    "The CCS screening framework includes glycemic assessment as part of the initial cardiovascular risk workup, because diabetes can move a patient into a statin-indicated category."
  );

  addTest(
    clarifyTests,
    "eGFR",
    "If kidney status is unclear",
    "The CCS screening framework includes kidney function assessment. Reduced eGFR can identify CKD, which is a statin-indicated condition when guideline criteria are met."
  );

  if (flags.diabetes || flags.ckd) {
    addTest(
      clarifyTests,
      "Urine albumin-to-creatinine ratio (ACR)",
      "If indicated; confirm over at least 3 months",
      "CCS defines CKD statin-indication using either eGFR <60 mL/min/1.73 m² or preserved eGFR with ACR ≥3 mg/mmol for at least 3 months."
    );
  }

  if (panel.tg != null && panel.tg > 4.5) {
    addTest(
      clarifyTests,
      "Repeat lipid panel in the fasting state",
      "Next available test",
      "CCS prefers nonfasting screening in most adults, but suggests fasting lipid/lipoprotein testing when there is a history of triglycerides >4.5 mmol/L."
    );
  }

  if (
    therapy === "none" &&
    age != null &&
    age >= 40 &&
    !statinIndicated &&
    ((frs != null && frs >= 10 && frs < 20) || (frs != null && frs >= 5 && flags.familyHistory))
  ) {
    addTest(
      clarifyTests,
      "Coronary artery calcium (CAC) score",
      "If the statin decision is uncertain",
      "CCS suggests CAC can help when adults 40+ are at intermediate risk and treatment is uncertain. It should not be used routinely in high-risk patients, those already on statins, or most low-risk adults."
    );
  }

  if (lipidStatinIndicated) {
    addTest(
      clarifyTests,
      "Familial hypercholesterolemia / genetic dyslipidemia assessment",
      "Now",
      "This is an inference from the CCS wording that very high LDL-C or non-HDL-C at low baseline risk often reflects a genetic dyslipidemia. Formal FH evaluation can help with diagnosis and cascade screening."
    );
  }

  if (
    therapy === "none" &&
    age != null &&
    age >= 40 &&
    !statinIndicated &&
    frs != null &&
    frs >= 10 &&
    frs < 20
  ) {
    addTest(
      followupTests,
      "If CAC is zero and statin is deferred",
      "Reassess, with repeat CAC rarely sooner than 5 years",
      "The CCS guideline notes that if a statin is withheld because CAC is 0, the decision should be revisited during follow-up or if clinical circumstances change."
    );
  }

  if (therapy === "none" && statinDecision === "no") {
    addTest(
      followupTests,
      "Repeat lipid screening and risk assessment",
      "Every 5 years from ages 40 to 75, or sooner if risk changes",
      "Repeat cardiovascular risk assessment every 5 years in most primary prevention adults, or sooner if risk status changes."
    );
  }

  return {
    riskCategory,
    primaryMarker,
    statinIndicated,
    lipidStatinIndicated,
    intermediateThresholdMet,
    riskModifierPresent,
    ageTrigger,
    statinAnswer,
    statinDecision,
    statinReason,
    triggerSummary,
    recommendations,
    clarifyTests,
    followupTests,
    rationale,
  };
}

function summarizePanel(panel) {
  return [
    { key: "totalChol", label: "TC", unit: "mmol/L", value: panel.totalChol },
    { key: "tg", label: "TG", unit: "mmol/L", value: panel.tg },
    { key: "hdl", label: "HDL-C", unit: "mmol/L", value: panel.hdl },
    { key: "ldl", label: "LDL-C", unit: "mmol/L", value: panel.ldl },
    { key: "nonHdl", label: "Non-HDL-C", unit: "mmol/L", value: panel.nonHdl },
    { key: "ratio", label: "TC/HDL", unit: "", value: panel.ratio },
  ].filter((item) => item.value != null);
}

return {
  SAMPLE_PANEL,
  buildAnalysis,
  parseLipidPanel,
  summarizePanel,
};
})();

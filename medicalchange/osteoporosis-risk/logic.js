window.OsteoporosisRiskLogic = (() => {
  const SAMPLE_BMD = `Age: 72
Sex: Female
Height: 160 cm
Weight: 62 kg

BONE MINERAL DENSITY
Lumbar Spine L1-L4 BMD 0.812 g/cm2 T-score -2.4
Total Hip BMD 0.701 g/cm2 T-score -2.1
Femoral Neck BMD 0.568 g/cm2 T-score -2.7

FRAX 10-year probability with BMD:
Major osteoporotic fracture 18.6%
Hip fracture 4.2%`;

  function parseNumber(value) {
    if (value == null || value === "") return null;
    const normalized = String(value).trim().replace(/[−–—]/g, "-").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeText(rawText) {
    return String(rawText ?? "")
      .replace(/[−–—]/g, "-")
      .replace(/\u00a0/g, " ");
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }

  function extractAge(text) {
    const match = firstMatch(text, [
      /\bage\s*[:=]?\s*(\d{2,3})\b/i,
      /\b(\d{2,3})\s*(?:years?|yrs?)\s*(?:old)?\b/i,
    ]);
    return match ? parseNumber(match[1]) : null;
  }

  function extractSex(text) {
    if (/\b(?:sex|gender)\s*[:=]?\s*f(?:emale)?\b/i.test(text) || /\bfemale\b/i.test(text)) return "female";
    if (/\b(?:sex|gender)\s*[:=]?\s*m(?:ale)?\b/i.test(text) || /\bmale\b/i.test(text)) return "male";
    return "";
  }

  function extractBodySize(text) {
    const pieces = [];
    const height = firstMatch(text, [/(?:height|ht)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(cm|in|inch|inches)\b/i]);
    const weight = firstMatch(text, [/(?:weight|wt)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(kg|lb|lbs|pounds?)\b/i]);
    if (height) pieces.push(`Height ${height[1]} ${height[2]}`);
    if (weight) pieces.push(`Weight ${weight[1]} ${weight[2]}`);
    return pieces.join("; ");
  }

  function numbersFromLine(line) {
    return [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => parseNumber(match[0])).filter((value) => value != null);
  }

  function extractSiteValue(lines, sitePatterns, valueType) {
    for (const line of lines) {
      if (!sitePatterns.some((pattern) => pattern.test(line))) continue;

      if (valueType === "tscore") {
        const labelled = line.match(/T[-\s]?score\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i);
        if (labelled) return parseNumber(labelled[1]);

        const numbers = numbersFromLine(line);
        const negativeScores = numbers.filter((value) => value <= 0 && value >= -6);
        if (negativeScores.length) return negativeScores[0];
      }

      if (valueType === "bmd") {
        const labelled = line.match(/BMD\s*[:=]?\s*(\d(?:\.\d+)?)/i);
        if (labelled) return parseNumber(labelled[1]);

        const numbers = numbersFromLine(line);
        const plausible = numbers.find((value) => value > 0.2 && value < 1.8);
        if (plausible != null) return plausible;
      }
    }
    return null;
  }

  function extractFraxRisk(text, kind) {
    const majorPatterns = [
      /major\s+osteoporotic(?:\s+fracture)?[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i,
      /10[-\s]?yr[^\n%]{0,80}major[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i,
      /MOF[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i,
    ];
    const hipPatterns = [
      /hip\s+fracture[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i,
      /10[-\s]?yr[^\n%]{0,80}hip[^\d]{0,30}(\d+(?:\.\d+)?)\s*%/i,
    ];
    const match = firstMatch(text, kind === "major" ? majorPatterns : hipPatterns);
    return match ? parseNumber(match[1]) : null;
  }

  function parseBmdReport(rawText) {
    const text = normalizeText(rawText);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return {
      age: extractAge(text),
      sex: extractSex(text),
      bodySize: extractBodySize(text),
      fnTScore: extractSiteValue(lines, [/femoral\s+neck/i, /\bneck\b/i], "tscore"),
      hipTScore: extractSiteValue(lines, [/total\s+hip/i, /\bhip\b/i], "tscore"),
      spineTScore: extractSiteValue(lines, [/lumbar/i, /spine/i, /L1\s*-?\s*L4/i], "tscore"),
      fnBmd: extractSiteValue(lines, [/femoral\s+neck/i, /\bneck\b/i], "bmd"),
      majorRisk: extractFraxRisk(text, "major"),
      hipRisk: extractFraxRisk(text, "hip"),
    };
  }

  function formatNumber(value, digits = 1) {
    if (value == null || !Number.isFinite(Number(value))) return "not entered";
    return Number(value).toFixed(digits);
  }

  function lowestTScore(values) {
    return values.filter((value) => value != null && Number.isFinite(value)).sort((a, b) => a - b)[0] ?? null;
  }

  function buildAssessment(inputs) {
    const age = parseNumber(inputs.age);
    const majorRisk = parseNumber(inputs.majorRisk);
    const hipRisk = parseNumber(inputs.hipRisk);
    const fnTScore = parseNumber(inputs.fnTScore);
    const hipTScore = parseNumber(inputs.hipTScore);
    const spineTScore = parseNumber(inputs.spineTScore);
    const lowest = lowestTScore([fnTScore, hipTScore, spineTScore]);

    const flags = {
      priorHip: Boolean(inputs.priorHip),
      priorVertebral: Boolean(inputs.priorVertebral),
      multipleFractures: Boolean(inputs.multipleFractures),
      recentFracture: Boolean(inputs.recentFracture),
      severeVertebral: Boolean(inputs.severeVertebral),
      secondaryCause: Boolean(inputs.secondaryCause),
      recurrentFalls: Boolean(inputs.recurrentFalls),
    };

    const highTriggers = [];
    const moderateTriggers = [];
    const imagingTriggers = [];
    const caveats = [];

    if (flags.priorHip) highTriggers.push("previous low-trauma hip fracture after age 40");
    if (flags.priorVertebral) highTriggers.push("previous vertebral fracture after age 40");
    if (flags.multipleFractures) highTriggers.push("two or more osteoporosis-related fractures after age 40");
    if (majorRisk != null && majorRisk >= 20) highTriggers.push(`10-year major osteoporotic fracture risk ${formatNumber(majorRisk)}%`);
    if (age != null && age >= 70 && lowest != null && lowest <= -2.5) highTriggers.push(`age ${age} with T-score ${formatNumber(lowest)} <= -2.5`);

    if (!highTriggers.length) {
      if (majorRisk != null && majorRisk >= 15 && majorRisk < 20) moderateTriggers.push(`10-year major osteoporotic fracture risk ${formatNumber(majorRisk)}%`);
      if (age != null && age < 70 && lowest != null && lowest <= -2.5) moderateTriggers.push(`age <70 with T-score ${formatNumber(lowest)} <= -2.5`);
    }

    if (age != null && age >= 65 && lowest != null && lowest <= -2.5) imagingTriggers.push("age >=65 with T-score <= -2.5");
    if (majorRisk != null && majorRisk >= 15 && majorRisk < 20) imagingTriggers.push("10-year major osteoporotic fracture risk 15-19.9%");

    if (majorRisk == null && !highTriggers.length && !moderateTriggers.length) {
      caveats.push("Enter the Canada-specific FRAX major osteoporotic fracture probability to complete the guideline threshold check.");
    }
    if (flags.recentFracture) caveats.push("Recent fracture carries higher imminent risk; the guideline says to give greater consideration to fractures in the last 2 years.");
    if (flags.secondaryCause) caveats.push("Possible secondary osteoporosis or complicating comorbidity: assess secondary causes and consider osteoporosis-expert advice if management is uncertain.");
    if (flags.recurrentFalls) caveats.push("FRAX/CAROC may underestimate risk with recurrent falls; clinical judgement should adjust the recommendation.");
    if (inputs.sex === "female" && inputs.postmenopausal === "no") caveats.push("The 2023 guideline treatment thresholds are framed for postmenopausal females and males aged 50 years and older.");
    if (age != null && age < 50) caveats.push("The encoded 2023 guideline pathway is for age 50 years and older.");
    if (flags.severeVertebral && lowest != null && lowest <= -2.5) caveats.push("Recent severe vertebral fracture or more than one vertebral fracture plus T-score <= -2.5: consider specialist advice about anabolic therapy.");

    let category = "incomplete";
    let title = "Need FRAX or a high-risk clinical trigger";
    let subtitle = "Paste BMD text and enter the Canada-specific FRAX major osteoporotic fracture risk.";
    let recommendation = "Complete FRAX probability entry, then reassess using the 2023 Osteoporosis Canada thresholds.";

    if (highTriggers.length) {
      category = "recommend";
      title = "Recommend pharmacotherapy";
      subtitle = "Meets a high-benefit 2023 Osteoporosis Canada treatment threshold.";
      recommendation = "Recommend osteoporosis pharmacotherapy, usually a bisphosphonate first-line unless contraindicated or not feasible. Assess secondary causes and treatment-specific limitations first.";
    } else if (moderateTriggers.length) {
      category = "suggest";
      title = "Suggest pharmacotherapy";
      subtitle = "Meets an intermediate-benefit 2023 Osteoporosis Canada treatment threshold.";
      recommendation = "Discuss and suggest osteoporosis pharmacotherapy using shared decision-making. Consider lateral spine imaging, especially if not already done.";
    } else if (majorRisk != null || lowest != null) {
      category = "no-routine-treatment";
      title = "Do not routinely recommend pharmacotherapy";
      subtitle = "No encoded 2023 treatment threshold is met.";
      recommendation = "Optimize exercise, falls prevention, calcium/protein intake, vitamin D when indicated, and reassess BMD/fracture risk at an interval based on risk.";
    }

    const reassessment = [];
    if (category === "recommend" || category === "suggest") {
      reassessment.push("If pharmacotherapy is started: reassess BMD and fracture risk in about 3 years.");
    } else if (majorRisk != null) {
      if (majorRisk < 10) reassessment.push("If not treated and major risk <10%: repeat BMD/fracture risk in 5-10 years.");
      else if (majorRisk < 15) reassessment.push("If not treated and major risk 10-15%: repeat BMD/fracture risk in about 5 years.");
      else reassessment.push("If not treated and major risk >=15%: repeat BMD/fracture risk in about 3 years.");
    }

    return {
      category,
      title,
      subtitle,
      recommendation,
      age,
      majorRisk,
      hipRisk,
      fnTScore,
      hipTScore,
      spineTScore,
      fnBmd: parseNumber(inputs.fnBmd),
      lowestTScore: lowest,
      highTriggers,
      moderateTriggers,
      imagingTriggers,
      caveats,
      reassessment,
    };
  }

  return {
    SAMPLE_BMD,
    parseBmdReport,
    buildAssessment,
    parseNumber,
  };
})();

if (typeof module !== "undefined") {
  module.exports = window.OsteoporosisRiskLogic;
}

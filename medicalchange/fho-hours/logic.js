window.FHOHoursLogic = (() => {
  const CATEGORY_ORDER = [
    "directInOffice",
    "directPhoneOutOfOffice",
    "indirectCare",
    "clinicalAdmin",
  ];

  const CATEGORY_DETAILS = {
    directInOffice: {
      key: "directInOffice",
      label: "Direct care: in-office / video",
      shortLabel: "Direct in-office",
      feeCode: "Q310",
      rate: 80,
    },
    directPhoneOutOfOffice: {
      key: "directPhoneOutOfOffice",
      label: "Direct care: telephone out-of-office",
      shortLabel: "Telephone out-of-office",
      feeCode: "Q311",
      rate: 68,
    },
    indirectCare: {
      key: "indirectCare",
      label: "Indirect patient care",
      shortLabel: "Indirect care",
      feeCode: "Q312",
      rate: 80,
    },
    clinicalAdmin: {
      key: "clinicalAdmin",
      label: "Clinical administration",
      shortLabel: "Clinical admin",
      feeCode: "Q313",
      rate: 80,
    },
  };

  const STORAGE_KEYS = {
    entries: "fho-hours.entries.v1",
    settings: "fho-hours.settings.v1",
    unlock: "fho-hours.unlocked.v1",
  };

  const DEFAULT_PLANNER = {
    directInOffice: 40,
    directPhoneOutOfOffice: 5,
    indirectCare: 20,
    clinicalAdmin: 15,
  };

  const DAILY_CAP_MINUTES = 14 * 60;
  const ROLLING_28_DAY_CAP_HOURS = 240;

  function toFiniteNumber(value, fallback = 0) {
    if (value == null || value === "") {
      return fallback;
    }

    const normalized = String(value).trim().replace(",", ".");
    if (!normalized) {
      return fallback;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function sanitizeHours(value) {
    return Math.max(0, toFiniteNumber(value, 0));
  }

  function sanitizeMinutes(value) {
    return Math.max(0, Math.round(toFiniteNumber(value, 0)));
  }

  function roundToOne(value) {
    return Number(toFiniteNumber(value, 0).toFixed(1));
  }

  function roundToTwo(value) {
    return Number(toFiniteNumber(value, 0).toFixed(2));
  }

  function hoursToMinutes(value) {
    return sanitizeMinutes(sanitizeHours(value) * 60);
  }

  function minutesToHours(value) {
    return sanitizeMinutes(value) / 60;
  }

  function buildMinuteMap(seed = 0) {
    return CATEGORY_ORDER.reduce((collection, key) => {
      collection[key] = seed;
      return collection;
    }, {});
  }

  function roundBillableMinutes(actualMinutes) {
    const minutes = sanitizeMinutes(actualMinutes);
    const remainder = minutes % 15;
    if (remainder === 0) {
      return minutes;
    }

    return minutes - remainder + (remainder >= 8 ? 15 : 0);
  }

  function parseIsoDate(dateString) {
    const match = String(dateString || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return {
      year,
      monthIndex: month - 1,
      day,
    };
  }

  function toDayNumber(dateString) {
    const parsed = parseIsoDate(dateString);
    if (!parsed) {
      return null;
    }

    return Math.floor(Date.UTC(parsed.year, parsed.monthIndex, parsed.day) / 86400000);
  }

  function monthKeyFromDate(dateString) {
    const parsed = parseIsoDate(dateString);
    if (!parsed) {
      return "";
    }

    const month = String(parsed.monthIndex + 1).padStart(2, "0");
    return `${parsed.year}-${month}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  function getProratedMonthCapHours(year, monthIndex) {
    const days = daysInMonth(year, monthIndex);
    return roundToOne((ROLLING_28_DAY_CAP_HOURS / 28) * days);
  }

  function normalizeEntry(rawEntry) {
    const minuteMap = buildMinuteMap(0);

    CATEGORY_ORDER.forEach((key) => {
      if (rawEntry?.minutes && rawEntry.minutes[key] != null) {
        minuteMap[key] = sanitizeMinutes(rawEntry.minutes[key]);
        return;
      }

      if (rawEntry?.[key] != null) {
        minuteMap[key] = sanitizeMinutes(rawEntry[key]);
        return;
      }

      if (rawEntry?.hours && rawEntry.hours[key] != null) {
        minuteMap[key] = hoursToMinutes(rawEntry.hours[key]);
      }
    });

    return {
      id: String(rawEntry?.id || ""),
      date: String(rawEntry?.date || ""),
      createdAt: rawEntry?.createdAt ? String(rawEntry.createdAt) : "",
      updatedAt: rawEntry?.updatedAt ? String(rawEntry.updatedAt) : "",
      minutes: minuteMap,
      notes: {
        indirectSummary: String(
          rawEntry?.notes?.indirectSummary ?? rawEntry?.indirectSummary ?? ""
        ).trim(),
        clinicalSummary: String(
          rawEntry?.notes?.clinicalSummary ?? rawEntry?.clinicalSummary ?? ""
        ).trim(),
        general: String(rawEntry?.notes?.general ?? rawEntry?.general ?? "").trim(),
      },
    };
  }

  function buildPayMap(minutesMap) {
    return CATEGORY_ORDER.reduce((collection, key) => {
      collection[key] = roundToTwo(
        minutesToHours(minutesMap[key]) * CATEGORY_DETAILS[key].rate
      );
      return collection;
    }, {});
  }

  function sumCategoryValues(map) {
    return CATEGORY_ORDER.reduce((total, key) => total + toFiniteNumber(map[key], 0), 0);
  }

  function computeEntryMetrics(rawEntry) {
    const entry = normalizeEntry(rawEntry);
    const billedMinutes = buildMinuteMap(0);

    CATEGORY_ORDER.forEach((key) => {
      billedMinutes[key] = roundBillableMinutes(entry.minutes[key]);
    });

    const actualTotalMinutes = sumCategoryValues(entry.minutes);
    const billedTotalMinutes = sumCategoryValues(billedMinutes);
    const payByCategory = buildPayMap(billedMinutes);
    const estimatedPay = roundToTwo(sumCategoryValues(payByCategory));
    const warnings = [];

    if (billedTotalMinutes > DAILY_CAP_MINUTES) {
      warnings.push({
        tone: "alert",
        text: `Billed time exceeds the 14-hour daily cap by ${roundToOne(
          minutesToHours(billedTotalMinutes - DAILY_CAP_MINUTES)
        )} hours.`,
      });
    }

    if (entry.minutes.indirectCare > 0 && !entry.notes.indirectSummary) {
      warnings.push({
        tone: "caution",
        text: "Indirect care is logged without a daily summary note.",
      });
    }

    if (entry.minutes.clinicalAdmin > 0 && !entry.notes.clinicalSummary) {
      warnings.push({
        tone: "caution",
        text: "Clinical administration is logged without a daily summary note.",
      });
    }

    return {
      ...entry,
      actualHours: CATEGORY_ORDER.reduce((collection, key) => {
        collection[key] = roundToTwo(minutesToHours(entry.minutes[key]));
        return collection;
      }, {}),
      billedMinutes,
      billedHours: CATEGORY_ORDER.reduce((collection, key) => {
        collection[key] = roundToTwo(minutesToHours(billedMinutes[key]));
        return collection;
      }, {}),
      billedUnits: CATEGORY_ORDER.reduce((collection, key) => {
        collection[key] = billedMinutes[key] / 15;
        return collection;
      }, {}),
      payByCategory,
      totals: {
        actualMinutes: actualTotalMinutes,
        actualHours: roundToTwo(minutesToHours(actualTotalMinutes)),
        billedMinutes: billedTotalMinutes,
        billedHours: roundToTwo(minutesToHours(billedTotalMinutes)),
        estimatedPay,
      },
      warnings,
    };
  }

  function computePlannerEligibility(values) {
    const input = {
      directInOffice: sanitizeHours(values?.directInOffice),
      directPhoneOutOfOffice: sanitizeHours(values?.directPhoneOutOfOffice),
      indirectCare: sanitizeHours(values?.indirectCare),
      clinicalAdmin: sanitizeHours(values?.clinicalAdmin),
    };

    const totalDirect = input.directInOffice + input.directPhoneOutOfOffice;
    const totalActual =
      totalDirect + input.indirectCare + input.clinicalAdmin;
    const maxAllowed = Math.min(totalActual, (totalDirect * 4) / 3);
    const eligible = {
      directInOffice: input.directInOffice,
      directPhoneOutOfOffice: input.directPhoneOutOfOffice,
      clinicalAdmin: Math.min(input.clinicalAdmin, 0.05 * maxAllowed),
      indirectCare: 0,
    };

    eligible.indirectCare = Math.min(
      input.indirectCare,
      Math.max(0, 0.25 * maxAllowed - eligible.clinicalAdmin)
    );

    const eligibleTotal =
      eligible.directInOffice +
      eligible.directPhoneOutOfOffice +
      eligible.indirectCare +
      eligible.clinicalAdmin;

    const percentages = {
      directInOffice: eligibleTotal ? (eligible.directInOffice * 100) / eligibleTotal : 0,
      directPhoneOutOfOffice: eligibleTotal
        ? (eligible.directPhoneOutOfOffice * 100) / eligibleTotal
        : 0,
      indirectCare: eligibleTotal ? (eligible.indirectCare * 100) / eligibleTotal : 0,
      clinicalAdmin: eligibleTotal ? (eligible.clinicalAdmin * 100) / eligibleTotal : 0,
      total: eligibleTotal ? 100 : 0,
    };

    const estimatedPay = roundToTwo(
      eligible.directInOffice * CATEGORY_DETAILS.directInOffice.rate +
        eligible.directPhoneOutOfOffice *
          CATEGORY_DETAILS.directPhoneOutOfOffice.rate +
        eligible.indirectCare * CATEGORY_DETAILS.indirectCare.rate +
        eligible.clinicalAdmin * CATEGORY_DETAILS.clinicalAdmin.rate
    );

    return {
      input,
      eligible: {
        directInOffice: roundToOne(eligible.directInOffice),
        directPhoneOutOfOffice: roundToOne(eligible.directPhoneOutOfOffice),
        indirectCare: roundToOne(eligible.indirectCare),
        clinicalAdmin: roundToOne(eligible.clinicalAdmin),
        total: roundToOne(eligibleTotal),
      },
      percentages: {
        directInOffice: roundToOne(percentages.directInOffice),
        directPhoneOutOfOffice: roundToOne(percentages.directPhoneOutOfOffice),
        indirectCare: roundToOne(percentages.indirectCare),
        clinicalAdmin: roundToOne(percentages.clinicalAdmin),
        total: roundToOne(percentages.total),
      },
      totals: {
        actual: roundToOne(totalActual),
        direct: roundToOne(totalDirect),
        maxAllowed: roundToOne(maxAllowed),
        estimatedPay,
      },
    };
  }

  function sortComputedEntries(entries) {
    return [...entries].sort((left, right) => {
      const leftDay = toDayNumber(left.date) ?? -Infinity;
      const rightDay = toDayNumber(right.date) ?? -Infinity;
      if (rightDay !== leftDay) {
        return rightDay - leftDay;
      }

      return String(right.updatedAt || right.createdAt || "").localeCompare(
        String(left.updatedAt || left.createdAt || "")
      );
    });
  }

  function computeRolling28DaySummary(rawEntries) {
    const computedEntries = sortComputedEntries(rawEntries.map(computeEntryMetrics)).reverse();
    if (!computedEntries.length) {
      return {
        peak: null,
        latest: null,
      };
    }

    let start = 0;
    let runningMinutes = 0;
    let peak = null;

    for (let end = 0; end < computedEntries.length; end += 1) {
      runningMinutes += computedEntries[end].totals.billedMinutes;

      while (
        toDayNumber(computedEntries[end].date) -
          toDayNumber(computedEntries[start].date) >
        27
      ) {
        runningMinutes -= computedEntries[start].totals.billedMinutes;
        start += 1;
      }

      if (!peak || runningMinutes > peak.totalMinutes) {
        peak = {
          startDate: computedEntries[start].date,
          endDate: computedEntries[end].date,
          totalMinutes: runningMinutes,
          totalHours: roundToOne(minutesToHours(runningMinutes)),
        };
      }
    }

    const latestEnd = computedEntries.length - 1;
    const latestWindowStart = (() => {
      let index = latestEnd;
      while (
        index > 0 &&
        toDayNumber(computedEntries[latestEnd].date) -
          toDayNumber(computedEntries[index - 1].date) <=
          27
      ) {
        index -= 1;
      }
      return index;
    })();

    const latestMinutes = computedEntries
      .slice(latestWindowStart)
      .reduce((total, entry) => total + entry.totals.billedMinutes, 0);

    return {
      peak,
      latest: {
        startDate: computedEntries[latestWindowStart].date,
        endDate: computedEntries[latestEnd].date,
        totalMinutes: latestMinutes,
        totalHours: roundToOne(minutesToHours(latestMinutes)),
      },
    };
  }

  function computeMonthSummary(rawEntries, monthKey) {
    const computedEntries = sortComputedEntries(rawEntries.map(computeEntryMetrics));
    const selectedEntries = monthKey
      ? computedEntries.filter((entry) => monthKeyFromDate(entry.date) === monthKey)
      : computedEntries;

    const actualMinutes = buildMinuteMap(0);
    const billedMinutes = buildMinuteMap(0);
    const payTotals = buildMinuteMap(0);

    selectedEntries.forEach((entry) => {
      CATEGORY_ORDER.forEach((key) => {
        actualMinutes[key] += entry.minutes[key];
        billedMinutes[key] += entry.billedMinutes[key];
        payTotals[key] += entry.payByCategory[key];
      });
    });

    const actualTotalMinutes = sumCategoryValues(actualMinutes);
    const billedTotalMinutes = sumCategoryValues(billedMinutes);
    const totalEstimatedPay = roundToTwo(sumCategoryValues(payTotals));
    const indirectAdminMinutes =
      billedMinutes.indirectCare + billedMinutes.clinicalAdmin;
    const indirectAdminShare = billedTotalMinutes
      ? (indirectAdminMinutes * 100) / billedTotalMinutes
      : 0;
    const clinicalShare = billedTotalMinutes
      ? (billedMinutes.clinicalAdmin * 100) / billedTotalMinutes
      : 0;

    let monthCapHours = null;
    let monthCapRemainingHours = null;
    if (monthKey) {
      const [yearText, monthText] = monthKey.split("-");
      const year = Number(yearText);
      const monthIndex = Number(monthText) - 1;
      if (Number.isInteger(year) && Number.isInteger(monthIndex) && monthIndex >= 0) {
        monthCapHours = getProratedMonthCapHours(year, monthIndex);
        monthCapRemainingHours = roundToOne(
          Math.max(0, monthCapHours - minutesToHours(billedTotalMinutes))
        );
      }
    }

    const plannerEquivalent = computePlannerEligibility({
      directInOffice: minutesToHours(actualMinutes.directInOffice),
      directPhoneOutOfOffice: minutesToHours(actualMinutes.directPhoneOutOfOffice),
      indirectCare: minutesToHours(actualMinutes.indirectCare),
      clinicalAdmin: minutesToHours(actualMinutes.clinicalAdmin),
    });

    return {
      entries: selectedEntries,
      totals: {
        actualMinutes,
        billedMinutes,
        payTotals: CATEGORY_ORDER.reduce((collection, key) => {
          collection[key] = roundToTwo(payTotals[key]);
          return collection;
        }, {}),
        actualHours: roundToOne(minutesToHours(actualTotalMinutes)),
        billedHours: roundToOne(minutesToHours(billedTotalMinutes)),
        totalEstimatedPay,
      },
      counts: {
        entries: selectedEntries.length,
        daysOverCap: selectedEntries.filter(
          (entry) => entry.totals.billedMinutes > DAILY_CAP_MINUTES
        ).length,
        missingSummaryNotes: selectedEntries.filter(
          (entry) =>
            (entry.minutes.indirectCare > 0 && !entry.notes.indirectSummary) ||
            (entry.minutes.clinicalAdmin > 0 && !entry.notes.clinicalSummary)
        ).length,
      },
      ratios: {
        indirectAdminShare: roundToOne(indirectAdminShare),
        clinicalShare: roundToOne(clinicalShare),
      },
      monthCapHours,
      monthCapRemainingHours,
      plannerEquivalent,
    };
  }

  return {
    CATEGORY_ORDER,
    CATEGORY_DETAILS,
    DEFAULT_PLANNER,
    DAILY_CAP_MINUTES,
    ROLLING_28_DAY_CAP_HOURS,
    STORAGE_KEYS,
    computeEntryMetrics,
    computeMonthSummary,
    computePlannerEligibility,
    computeRolling28DaySummary,
    daysInMonth,
    getProratedMonthCapHours,
    hoursToMinutes,
    minutesToHours,
    monthKeyFromDate,
    normalizeEntry,
    parseIsoDate,
    roundBillableMinutes,
    roundToOne,
    roundToTwo,
    sanitizeHours,
    sanitizeMinutes,
    sortComputedEntries,
    toDayNumber,
  };
})();

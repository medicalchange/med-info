(() => {
  const logic = window.FHOHoursLogic;
  if (!logic) {
    return;
  }

  const {
    CATEGORY_ORDER,
    CATEGORY_DETAILS,
    DEFAULT_PLANNER,
    STORAGE_KEYS,
    computeEntryMetrics,
    computeMonthSummary,
    computePlannerEligibility,
    computeRolling28DaySummary,
    hoursToMinutes,
    minutesToHours,
    monthKeyFromDate,
    normalizeEntry,
    parseIsoDate,
    roundToOne,
    sanitizeHours,
    sanitizeMinutes,
    sortComputedEntries,
  } = logic;

  const currencyFormatter = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  });

  const state = {
    entries: loadEntries(),
    selectedMonth: currentMonthKey(),
    editingId: "",
    planner: { ...DEFAULT_PLANNER },
    settings: loadSettings(),
    unlocked: false,
    status: {
      tone: "neutral",
      message: "",
    },
  };

  const els = {
    appShell: document.querySelector("#app-shell"),
    appStatus: document.querySelector("#app-status"),
    cancelEditButton: document.querySelector("#cancel-edit"),
    changePasscodeButton: document.querySelector("#change-passcode"),
    csvExportButton: document.querySelector("#export-csv"),
    entryDate: document.querySelector("#entry-date"),
    entryError: document.querySelector("#entry-error"),
    entryForm: document.querySelector("#entry-form"),
    entryFormTitle: document.querySelector("#entry-form-title"),
    entryId: document.querySelector("#entry-id"),
    entryPreview: document.querySelector("#entry-preview"),
    heroCapLeft: document.querySelector("#hero-cap-left"),
    heroMonthHours: document.querySelector("#hero-month-hours"),
    heroMonthLabel: document.querySelector("#hero-month-label"),
    heroMonthPay: document.querySelector("#hero-month-pay"),
    heroRolling: document.querySelector("#hero-rolling"),
    importButton: document.querySelector("#import-json"),
    importFile: document.querySelector("#import-file"),
    jsonExportButton: document.querySelector("#export-json"),
    ledgerBody: document.querySelector("#ledger-body"),
    ledgerCount: document.querySelector("#ledger-count"),
    lockConfirm: document.querySelector("#lock-confirm"),
    lockConfirmWrap: document.querySelector("#lock-confirm-wrap"),
    lockCopy: document.querySelector("#lock-copy"),
    lockError: document.querySelector("#lock-error"),
    lockForm: document.querySelector("#lock-form"),
    lockHint: document.querySelector("#lock-hint"),
    lockHintDisplay: document.querySelector("#lock-hint-display"),
    lockPasscode: document.querySelector("#lock-passcode"),
    lockScreen: document.querySelector("#lock-screen"),
    lockSubmit: document.querySelector("#lock-submit"),
    lockTitle: document.querySelector("#lock-title"),
    lockNowButton: document.querySelector("#lock-now"),
    monthFilter: document.querySelector("#month-filter"),
    noteClinical: document.querySelector("#note-clinical"),
    noteGeneral: document.querySelector("#note-general"),
    noteIndirect: document.querySelector("#note-indirect"),
    plannerAdmin: document.querySelector("#planner-admin"),
    plannerDirect: document.querySelector("#planner-direct"),
    plannerIndirect: document.querySelector("#planner-indirect"),
    plannerTable: document.querySelector("#planner-table"),
    plannerTelephone: document.querySelector("#planner-telephone"),
    rulesGrid: document.querySelector("#rules-grid"),
    summaryCards: document.querySelector("#summary-cards"),
  };

  const durationFieldIds = {
    directInOffice: {
      hours: document.querySelector("#direct-in-office-hours"),
      minutes: document.querySelector("#direct-in-office-minutes"),
    },
    directPhoneOutOfOffice: {
      hours: document.querySelector("#direct-phone-hours"),
      minutes: document.querySelector("#direct-phone-minutes"),
    },
    indirectCare: {
      hours: document.querySelector("#indirect-hours"),
      minutes: document.querySelector("#indirect-minutes"),
    },
    clinicalAdmin: {
      hours: document.querySelector("#admin-hours"),
      minutes: document.querySelector("#admin-minutes"),
    },
  };

  initialize();

  function initialize() {
    bindEvents();
    renderLockState();
    if (state.settings.lockHash && sessionStorage.getItem(STORAGE_KEYS.unlock) === "true") {
      unlockApp();
    } else {
      state.unlocked = false;
      els.lockScreen.classList.remove("is-hidden");
      els.appShell.classList.add("is-hidden");
    }
    resetEntryForm();
    render();
  }

  function bindEvents() {
    els.lockForm?.addEventListener("submit", handleLockSubmit);
    els.entryForm?.addEventListener("submit", handleEntrySubmit);
    els.entryForm?.addEventListener("reset", () => {
      window.requestAnimationFrame(() => {
        resetEntryForm();
        renderEntryPreview();
      });
    });

    Object.values(durationFieldIds).forEach((pair) => {
      pair.hours.addEventListener("input", renderEntryPreview);
      pair.minutes.addEventListener("input", renderEntryPreview);
    });

    [els.noteIndirect, els.noteClinical, els.noteGeneral, els.entryDate].forEach((field) => {
      field?.addEventListener("input", renderEntryPreview);
      field?.addEventListener("change", renderEntryPreview);
    });

    els.cancelEditButton?.addEventListener("click", () => {
      resetEntryForm();
      renderEntryPreview();
    });

    els.monthFilter?.addEventListener("change", () => {
      state.selectedMonth = els.monthFilter.value || currentMonthKey();
      render();
    });

    [
      [els.plannerDirect, "directInOffice"],
      [els.plannerTelephone, "directPhoneOutOfOffice"],
      [els.plannerIndirect, "indirectCare"],
      [els.plannerAdmin, "clinicalAdmin"],
    ].forEach(([field, key]) => {
      field?.addEventListener("input", () => {
        state.planner[key] = sanitizeHours(field.value);
        renderPlanner();
      });
    });

    els.ledgerBody?.addEventListener("click", handleLedgerAction);
    els.jsonExportButton?.addEventListener("click", exportJsonBackup);
    els.csvExportButton?.addEventListener("click", exportSelectedMonthCsv);
    els.importButton?.addEventListener("click", () => els.importFile?.click());
    els.importFile?.addEventListener("change", importJsonBackup);
    els.changePasscodeButton?.addEventListener("click", changePasscode);
    els.lockNowButton?.addEventListener("click", lockNow);
  }

  function loadEntries() {
    const parsed = readStorage(STORAGE_KEYS.entries, []);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortComputedEntries(
      parsed.map(normalizeEntry).filter((entry) => parseIsoDate(entry.date))
    );
  }

  function loadSettings() {
    const parsed = readStorage(STORAGE_KEYS.settings, {});
    return {
      lockHash: String(parsed?.lockHash || ""),
      hint: String(parsed?.hint || ""),
    };
  }

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function saveEntries() {
    writeStorage(STORAGE_KEYS.entries, state.entries);
  }

  function saveSettings() {
    writeStorage(STORAGE_KEYS.settings, state.settings);
  }

  async function handleLockSubmit(event) {
    event.preventDefault();
    const passcode = els.lockPasscode.value.trim();
    const confirm = els.lockConfirm.value.trim();
    const hint = els.lockHint.value.trim();

    if (!state.settings.lockHash) {
      if (passcode.length < 6) {
        showLockError("Use a passcode with at least 6 characters.");
        return;
      }

      if (passcode !== confirm) {
        showLockError("Passcodes do not match.");
        return;
      }

      state.settings.lockHash = await hashPasscode(passcode);
      state.settings.hint = hint;
      saveSettings();
      clearLockForm();
      unlockApp();
      setStatus("Passcode saved. This tool is now locked to this browser session.", "good");
      render();
      return;
    }

    const inputHash = await hashPasscode(passcode);
    if (inputHash !== state.settings.lockHash) {
      showLockError("That passcode does not match.");
      return;
    }

    clearLockForm();
    unlockApp();
    render();
  }

  function showLockError(message) {
    els.lockError.textContent = message;
  }

  function clearLockForm() {
    els.lockError.textContent = "";
    els.lockPasscode.value = "";
    els.lockConfirm.value = "";
  }

  function renderLockState() {
    const setupMode = !state.settings.lockHash;
    els.lockTitle.textContent = setupMode ? "Set a local passcode" : "Unlock your hour tracker";
    els.lockCopy.textContent = setupMode
      ? "This app stores your log in this browser. Set a passcode so the tracker is not visible without unlocking it first."
      : "Enter your passcode to view your saved hours and notes on this device.";
    els.lockSubmit.textContent = setupMode ? "Save passcode" : "Unlock";
    els.lockConfirmWrap.classList.toggle("is-hidden", !setupMode);
    els.lockHintDisplay.hidden = setupMode || !state.settings.hint;
    els.lockHintDisplay.textContent = state.settings.hint
      ? `Hint: ${state.settings.hint}`
      : "";
    els.lockHint.value = state.settings.hint || "";
  }

  function unlockApp() {
    state.unlocked = true;
    sessionStorage.setItem(STORAGE_KEYS.unlock, "true");
    els.lockScreen.classList.add("is-hidden");
    els.appShell.classList.remove("is-hidden");
  }

  function lockNow() {
    state.unlocked = false;
    sessionStorage.removeItem(STORAGE_KEYS.unlock);
    renderLockState();
    els.appShell.classList.add("is-hidden");
    els.lockScreen.classList.remove("is-hidden");
    setStatus("Tracker locked.", "neutral");
  }

  async function changePasscode() {
    const newPasscode = window.prompt("Enter a new passcode for this browser:");
    if (newPasscode == null) {
      return;
    }

    if (newPasscode.trim().length < 6) {
      setStatus("Passcode update cancelled. Use at least 6 characters.", "caution");
      return;
    }

    const confirmation = window.prompt("Re-enter the new passcode:");
    if (confirmation == null || confirmation.trim() !== newPasscode.trim()) {
      setStatus("Passcode update cancelled because the entries did not match.", "caution");
      return;
    }

    const hint = window.prompt("Optional hint for future unlocks:", state.settings.hint || "");
    state.settings.lockHash = await hashPasscode(newPasscode.trim());
    state.settings.hint = hint == null ? state.settings.hint : hint.trim();
    saveSettings();
    renderLockState();
    setStatus("Passcode updated.", "good");
  }

  async function hashPasscode(value) {
    const bytes = new TextEncoder().encode(value);
    const buffer = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function handleEntrySubmit(event) {
    event.preventDefault();
    els.entryError.textContent = "";

    const date = els.entryDate.value;
    if (!parseIsoDate(date)) {
      els.entryError.textContent = "Choose a valid date.";
      return;
    }

    const minutes = readEntryDurations();
    const totalMinutes = CATEGORY_ORDER.reduce((total, key) => total + minutes[key], 0);
    if (!totalMinutes) {
      els.entryError.textContent = "Enter at least one duration before saving.";
      return;
    }

    const nextEntry = {
      id: state.editingId || createId(),
      date,
      createdAt: state.editingId
        ? state.entries.find((entry) => entry.id === state.editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      minutes,
      notes: {
        indirectSummary: els.noteIndirect.value.trim(),
        clinicalSummary: els.noteClinical.value.trim(),
        general: els.noteGeneral.value.trim(),
      },
    };

    if (state.editingId) {
      state.entries = state.entries.map((entry) => (entry.id === state.editingId ? nextEntry : entry));
      setStatus(`Updated ${formatDateLabel(date)}.`, "good");
    } else {
      state.entries = [nextEntry, ...state.entries];
      setStatus(`Saved ${formatDateLabel(date)}.`, "good");
    }

    state.entries = sortComputedEntries(state.entries);
    state.selectedMonth = monthKeyFromDate(date) || state.selectedMonth;
    saveEntries();
    resetEntryForm();
    render();
  }

  function createId() {
    return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readEntryDurations() {
    return CATEGORY_ORDER.reduce((collection, key) => {
      const hours = sanitizeHours(durationFieldIds[key].hours.value);
      const minutes = Math.min(59, sanitizeMinutes(durationFieldIds[key].minutes.value));
      collection[key] = hoursToMinutes(hours) + minutes;
      return collection;
    }, {});
  }

  function resetEntryForm() {
    state.editingId = "";
    els.entryId.value = "";
    els.entryDate.value = todayKey();
    els.noteIndirect.value = "";
    els.noteClinical.value = "";
    els.noteGeneral.value = "";
    CATEGORY_ORDER.forEach((key) => setDurationFields(key, 0));
    els.entryFormTitle.textContent = "Add a day";
    els.cancelEditButton.classList.add("is-hidden");
    els.entryError.textContent = "";
    renderEntryPreview();
  }

  function setDurationFields(key, totalMinutes) {
    const safeMinutes = sanitizeMinutes(totalMinutes);
    durationFieldIds[key].hours.value = Math.floor(safeMinutes / 60);
    durationFieldIds[key].minutes.value = safeMinutes % 60;
  }

  function render() {
    if (!state.unlocked) {
      renderLockState();
      return;
    }

    renderLockState();
    els.monthFilter.value = state.selectedMonth;
    renderEntryPreview();
    renderDashboard();
    renderPlanner();
    renderStatusLine();
  }

  function renderDashboard() {
    const monthSummary = computeMonthSummary(state.entries, state.selectedMonth);
    const rolling = computeRolling28DaySummary(state.entries);

    renderHero(monthSummary, rolling);
    renderSummaryCards(monthSummary, rolling);
    renderRules(monthSummary, rolling);
    renderLedger(monthSummary);
  }

  function renderHero(monthSummary, rolling) {
    els.heroMonthLabel.textContent = formatMonthLabel(state.selectedMonth);
    els.heroMonthHours.textContent = `${monthSummary.totals.billedHours.toFixed(1)} h`;
    els.heroMonthPay.textContent = `${formatCurrency(monthSummary.totals.totalEstimatedPay)} estimated hourly-rate pay`;
    els.heroCapLeft.textContent = monthSummary.monthCapRemainingHours == null
      ? "--"
      : `${monthSummary.monthCapRemainingHours.toFixed(1)} h`;
    els.heroRolling.textContent = rolling.peak
      ? `${rolling.peak.totalHours.toFixed(1)} h`
      : "0.0 h";
  }

  function renderSummaryCards(monthSummary, rolling) {
    const plannerGap = roundToOne(
      Math.max(0, monthSummary.totals.actualHours - monthSummary.plannerEquivalent.eligible.total)
    );
    const cards = [
      {
        label: "Logged actual hours",
        value: `${monthSummary.totals.actualHours.toFixed(1)} h`,
        detail: `${monthSummary.counts.entries} saved ${monthSummary.counts.entries === 1 ? "day" : "days"}`,
      },
      {
        label: "Rounded billable hours",
        value: `${monthSummary.totals.billedHours.toFixed(1)} h`,
        detail: "Each fee code rounded in daily 15-minute units",
      },
      {
        label: "Estimated hourly-rate pay",
        value: formatCurrency(monthSummary.totals.totalEstimatedPay),
        detail: "Hourly rate only; excludes shadow billing and bonuses",
      },
      {
        label: "Planner-equivalent eligible",
        value: `${monthSummary.plannerEquivalent.eligible.total.toFixed(1)} h`,
        detail: plannerGap > 0 ? `${plannerGap.toFixed(1)} h above OMA calculator-style allowance` : "Aligned with OMA calculator-style allowance",
      },
      {
        label: "Indirect + admin share",
        value: `${monthSummary.ratios.indirectAdminShare.toFixed(1)}%`,
        detail: "Target at or below 25% of billed hours",
      },
      {
        label: "Peak rolling 28 days",
        value: rolling.peak ? `${rolling.peak.totalHours.toFixed(1)} h` : "0.0 h",
        detail: `Cap is ${logic.ROLLING_28_DAY_CAP_HOURS.toFixed(0)} h`,
      },
    ];

    els.summaryCards.innerHTML = cards
      .map(
        (card) => `
          <article class="summary-card">
            <p>${escapeHtml(card.label)}</p>
            <strong>${escapeHtml(card.value)}</strong>
            <span>${escapeHtml(card.detail)}</span>
          </article>
        `
      )
      .join("");
  }

  function renderRules(monthSummary, rolling) {
    const plannerGap = roundToOne(
      Math.max(0, monthSummary.totals.actualHours - monthSummary.plannerEquivalent.eligible.total)
    );
    const rules = [
      buildRuleCard(
        monthSummary.counts.daysOverCap ? "alert" : "good",
        "Daily 14-hour cap",
        monthSummary.counts.daysOverCap
          ? `${monthSummary.counts.daysOverCap} saved ${monthSummary.counts.daysOverCap === 1 ? "day exceeds" : "days exceed"} the daily payable limit.`
          : "No saved day in this month exceeds the 14-hour payable limit."
      ),
      buildRuleCard(
        monthSummary.ratios.indirectAdminShare > 25 ? "alert" : "good",
        "Indirect + admin ratio",
        `${monthSummary.ratios.indirectAdminShare.toFixed(1)}% of billed hours. Keep this at or below 25%.`
      ),
      buildRuleCard(
        monthSummary.ratios.clinicalShare > 5 ? "caution" : "good",
        "Clinical admin ratio",
        `${monthSummary.ratios.clinicalShare.toFixed(1)}% of billed hours. The OMA calculator logic uses a 5% ceiling.`
      ),
      buildRuleCard(
        monthSummary.counts.missingSummaryNotes ? "caution" : "good",
        "Daily summary notes",
        monthSummary.counts.missingSummaryNotes
          ? `${monthSummary.counts.missingSummaryNotes} saved ${monthSummary.counts.missingSummaryNotes === 1 ? "entry is" : "entries are"} missing an indirect or clinical summary.`
          : "Indirect and clinical-admin entries all have summary notes."
      ),
      buildRuleCard(
        rolling.peak && rolling.peak.totalHours > logic.ROLLING_28_DAY_CAP_HOURS ? "alert" : "good",
        "Rolling 28-day peak",
        rolling.peak
          ? `${rolling.peak.totalHours.toFixed(1)} h from ${formatDateLabel(rolling.peak.startDate)} to ${formatDateLabel(rolling.peak.endDate)}.`
          : "No hours saved yet."
      ),
      buildRuleCard(
        plannerGap > 0 ? "caution" : "good",
        "OMA planner comparison",
        plannerGap > 0
          ? `Logged actual hours are ${plannerGap.toFixed(1)} h above the OMA calculator-style eligible total for this month.`
          : "Logged hours sit within the OMA calculator-style mix rules for this month."
      ),
    ];

    els.rulesGrid.innerHTML = rules.join("");
  }

  function buildRuleCard(tone, title, body) {
    return `
      <article class="rule-card tone-${escapeHtml(tone)}">
        <span class="rule-pill">${toneLabel(tone)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </article>
    `;
  }

  function toneLabel(tone) {
    if (tone === "alert") {
      return "Needs attention";
    }
    if (tone === "caution") {
      return "Watch";
    }
    return "On track";
  }

  function renderLedger(monthSummary) {
    const entries = monthSummary.entries;
    els.ledgerCount.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

    if (!entries.length) {
      els.ledgerBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">No saved days for ${escapeHtml(formatMonthLabel(state.selectedMonth))} yet.</div>
          </td>
        </tr>
      `;
      return;
    }

    els.ledgerBody.innerHTML = entries
      .map((entry) => {
        const warningText = entry.warnings.length
          ? entry.warnings.map((warning) => warning.text).join(" ")
          : "No immediate rule warnings.";
        return `
          <tr>
            <td>
              <strong>${escapeHtml(formatDateLabel(entry.date))}</strong>
              <span class="table-subline">${escapeHtml(warningText)}</span>
            </td>
            <td>${buildCategoryLines(entry.actualHours)}</td>
            <td>${buildCategoryLines(entry.billedHours, true)}</td>
            <td>
              <strong>${escapeHtml(formatCurrency(entry.totals.estimatedPay))}</strong>
              <span class="table-subline">${entry.totals.billedHours.toFixed(2)} billed h</span>
            </td>
            <td>${buildNoteLines(entry.notes)}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="mini-button" data-action="edit" data-entry-id="${escapeHtml(entry.id)}">Edit</button>
                <button type="button" class="mini-button danger" data-action="delete" data-entry-id="${escapeHtml(entry.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function buildCategoryLines(hoursMap, includeFeeCodes = false) {
    return CATEGORY_ORDER.map((key) => {
      const detail = CATEGORY_DETAILS[key];
      const label = includeFeeCodes ? `${detail.feeCode}` : detail.shortLabel;
      return `<div class="table-line"><span>${escapeHtml(label)}</span><strong>${hoursMap[key].toFixed(2)} h</strong></div>`;
    }).join("");
  }

  function buildNoteLines(notes) {
    const pieces = [];
    if (notes.indirectSummary) {
      pieces.push(`<div class="note-chip"><span>Indirect</span>${escapeHtml(notes.indirectSummary)}</div>`);
    }
    if (notes.clinicalSummary) {
      pieces.push(`<div class="note-chip"><span>Clinical</span>${escapeHtml(notes.clinicalSummary)}</div>`);
    }
    if (notes.general) {
      pieces.push(`<div class="note-chip"><span>General</span>${escapeHtml(notes.general)}</div>`);
    }

    return pieces.length ? pieces.join("") : '<span class="table-subline">No notes saved.</span>';
  }

  function handleLedgerAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const entryId = button.getAttribute("data-entry-id");
    if (!entryId) {
      return;
    }

    if (button.dataset.action === "edit") {
      startEditing(entryId);
      return;
    }

    if (button.dataset.action === "delete") {
      const match = state.entries.find((entry) => entry.id === entryId);
      if (!match) {
        return;
      }

      const confirmed = window.confirm(`Delete the saved entry for ${formatDateLabel(match.date)}?`);
      if (!confirmed) {
        return;
      }

      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      saveEntries();
      if (state.editingId === entryId) {
        resetEntryForm();
      }
      setStatus(`Deleted ${formatDateLabel(match.date)}.`, "neutral");
      render();
    }
  }

  function startEditing(entryId) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    const normalized = normalizeEntry(entry);
    state.editingId = normalized.id;
    els.entryId.value = normalized.id;
    els.entryDate.value = normalized.date;
    CATEGORY_ORDER.forEach((key) => setDurationFields(key, normalized.minutes[key]));
    els.noteIndirect.value = normalized.notes.indirectSummary;
    els.noteClinical.value = normalized.notes.clinicalSummary;
    els.noteGeneral.value = normalized.notes.general;
    els.entryFormTitle.textContent = `Edit ${formatDateLabel(normalized.date)}`;
    els.cancelEditButton.classList.remove("is-hidden");
    els.entryError.textContent = "";
    renderEntryPreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderEntryPreview() {
    const date = els.entryDate.value;
    const metrics = computeEntryMetrics({
      date,
      minutes: readEntryDurations(),
      notes: {
        indirectSummary: els.noteIndirect.value.trim(),
        clinicalSummary: els.noteClinical.value.trim(),
        general: els.noteGeneral.value.trim(),
      },
    });

    if (!metrics.totals.actualMinutes) {
      els.entryPreview.innerHTML = '<p class="preview-empty">Enter time to see the rounded daily billing preview.</p>';
      return;
    }

    const warnings = metrics.warnings.length
      ? `<div class="preview-warnings">${metrics.warnings
          .map((warning) => `<span class="preview-warning tone-${escapeHtml(warning.tone)}">${escapeHtml(warning.text)}</span>`)
          .join("")}</div>`
      : "";

    els.entryPreview.innerHTML = `
      <div class="preview-head">
        <strong>${metrics.totals.actualHours.toFixed(2)} actual h</strong>
        <span>${metrics.totals.billedHours.toFixed(2)} billed h after rounding</span>
        <span>${escapeHtml(formatCurrency(metrics.totals.estimatedPay))} estimated pay</span>
      </div>
      <div class="preview-grid">
        ${CATEGORY_ORDER.map((key) => {
          const detail = CATEGORY_DETAILS[key];
          return `
            <article class="preview-card">
              <p>${escapeHtml(detail.feeCode)}</p>
              <strong>${metrics.billedHours[key].toFixed(2)} h</strong>
              <span>${metrics.actualHours[key].toFixed(2)} h logged</span>
            </article>
          `;
        }).join("")}
      </div>
      ${warnings}
    `;
  }

  function renderPlanner() {
    els.plannerDirect.value = state.planner.directInOffice;
    els.plannerTelephone.value = state.planner.directPhoneOutOfOffice;
    els.plannerIndirect.value = state.planner.indirectCare;
    els.plannerAdmin.value = state.planner.clinicalAdmin;

    const planner = computePlannerEligibility(state.planner);
    const rows = [
      ["Max Direct", planner.eligible.directInOffice, planner.percentages.directInOffice],
      ["Telephone Out-of-Office", planner.eligible.directPhoneOutOfOffice, planner.percentages.directPhoneOutOfOffice],
      ["Max Indirect", planner.eligible.indirectCare, planner.percentages.indirectCare],
      ["Max CAT", planner.eligible.clinicalAdmin, planner.percentages.clinicalAdmin],
      ["Maximum Allowable Billed", planner.eligible.total, planner.percentages.total],
    ];

    els.plannerTable.innerHTML = `
      <div class="planner-summary-bar">
        <div>
          <span>Actual weekly hours</span>
          <strong>${planner.totals.actual.toFixed(1)} h</strong>
        </div>
        <div>
          <span>Direct hours</span>
          <strong>${planner.totals.direct.toFixed(1)} h</strong>
        </div>
        <div>
          <span>Estimated pay</span>
          <strong>${escapeHtml(formatCurrency(planner.totals.estimatedPay))}</strong>
        </div>
      </div>
      <div class="planner-grid-head planner-grid-row">
        <span>Category</span>
        <span>Eligible hours</span>
        <span>% of billable time</span>
      </div>
      ${rows
        .map(
          ([label, hours, share]) => `
            <div class="planner-grid-row ${label === "Maximum Allowable Billed" ? "is-total" : ""}">
              <span>${escapeHtml(label)}</span>
              <strong>${Number(hours).toFixed(1)}</strong>
              <span>${Number(share).toFixed(1)}%</span>
            </div>
          `
        )
        .join("")}
    `;
  }

  function exportJsonBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
    };

    downloadText(
      `fho-hours-backup-${todayKey()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setStatus("JSON backup downloaded.", "good");
  }

  function exportSelectedMonthCsv() {
    const monthSummary = computeMonthSummary(state.entries, state.selectedMonth);
    if (!monthSummary.entries.length) {
      setStatus("There are no saved days in the selected month to export.", "caution");
      return;
    }

    const header = [
      "date",
      "direct_in_office_actual_hours",
      "telephone_out_actual_hours",
      "indirect_actual_hours",
      "clinical_admin_actual_hours",
      "actual_total_hours",
      "q310_billed_hours",
      "q311_billed_hours",
      "q312_billed_hours",
      "q313_billed_hours",
      "billed_total_hours",
      "estimated_pay_cad",
      "indirect_summary",
      "clinical_summary",
      "general_note",
    ];

    const lines = monthSummary.entries.map((entry) => [
      entry.date,
      entry.actualHours.directInOffice.toFixed(2),
      entry.actualHours.directPhoneOutOfOffice.toFixed(2),
      entry.actualHours.indirectCare.toFixed(2),
      entry.actualHours.clinicalAdmin.toFixed(2),
      entry.totals.actualHours.toFixed(2),
      entry.billedHours.directInOffice.toFixed(2),
      entry.billedHours.directPhoneOutOfOffice.toFixed(2),
      entry.billedHours.indirectCare.toFixed(2),
      entry.billedHours.clinicalAdmin.toFixed(2),
      entry.totals.billedHours.toFixed(2),
      entry.totals.estimatedPay.toFixed(2),
      entry.notes.indirectSummary,
      entry.notes.clinicalSummary,
      entry.notes.general,
    ]);

    const csv = [header, ...lines]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    downloadText(`fho-hours-${state.selectedMonth}.csv`, csv, "text/csv");
    setStatus(`CSV export downloaded for ${formatMonthLabel(state.selectedMonth)}.`, "good");
  }

  async function importJsonBackup(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextEntries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.entries)
          ? parsed.entries
          : null;

      if (!nextEntries) {
        throw new Error("Backup format not recognized.");
      }

      const confirmed = window.confirm(
        `Replace the current tracker data with ${nextEntries.length} imported ${nextEntries.length === 1 ? "entry" : "entries"}?`
      );
      if (!confirmed) {
        return;
      }

      state.entries = sortComputedEntries(
        nextEntries.map(normalizeEntry).filter((entry) => parseIsoDate(entry.date))
      );
      saveEntries();
      resetEntryForm();
      render();
      setStatus(`Imported ${state.entries.length} ${state.entries.length === 1 ? "entry" : "entries"}.`, "good");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.", "alert");
    } finally {
      event.target.value = "";
    }
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function setStatus(message, tone = "neutral") {
    state.status = { message, tone };
    renderStatusLine();
  }

  function renderStatusLine() {
    if (!els.appStatus) {
      return;
    }

    els.appStatus.textContent = state.status.message;
    els.appStatus.className = `status-line tone-${state.status.tone}`;
  }

  function formatMonthLabel(monthKey) {
    const [yearText, monthText] = String(monthKey || "").split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0) {
      return "Selected month";
    }

    return new Intl.DateTimeFormat("en-CA", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, monthIndex, 1));
  }

  function formatDateLabel(dateText) {
    const parsed = parseIsoDate(dateText);
    if (!parsed) {
      return dateText;
    }

    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(parsed.year, parsed.monthIndex, parsed.day));
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeCsv(value) {
    const text = String(value ?? "").replaceAll('"', '""');
    return `"${text}"`;
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function currentMonthKey() {
    return todayKey().slice(0, 7);
  }
})();

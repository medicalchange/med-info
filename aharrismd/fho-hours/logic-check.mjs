import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = await fs.readFile(path.join(__dirname, "logic.js"), "utf8");
const context = { window: {}, console };
vm.createContext(context);
new vm.Script(source, { filename: "logic.js" }).runInContext(context);

const logic = context.window.FHOHoursLogic;

assert.ok(logic, "Expected logic module to load");

assert.equal(logic.roundBillableMinutes(67), 60);
assert.equal(logic.roundBillableMinutes(68), 75);
assert.equal(logic.roundBillableMinutes(15), 15);

const entry = logic.computeEntryMetrics({
  date: "2026-04-03",
  minutes: {
    directInOffice: 187,
    directPhoneOutOfOffice: 28,
    indirectCare: 92,
    clinicalAdmin: 44,
  },
  notes: {
    indirectSummary: "Chart reviews and lab follow-up",
    clinicalSummary: "QI meeting and EMR template updates",
  },
});

assert.equal(entry.billedMinutes.directInOffice, 180);
assert.equal(entry.billedMinutes.directPhoneOutOfOffice, 30);
assert.equal(entry.billedMinutes.indirectCare, 90);
assert.equal(entry.billedMinutes.clinicalAdmin, 45);
assert.equal(entry.totals.billedHours, 5.75);
assert.equal(entry.payByCategory.directPhoneOutOfOffice, 34);
assert.equal(entry.totals.estimatedPay, 454);

const planner = logic.computePlannerEligibility({
  directInOffice: 40,
  directPhoneOutOfOffice: 5,
  indirectCare: 20,
  clinicalAdmin: 15,
});

assert.equal(planner.eligible.directInOffice, 40);
assert.equal(planner.eligible.directPhoneOutOfOffice, 5);
assert.equal(planner.eligible.indirectCare, 12);
assert.equal(planner.eligible.clinicalAdmin, 3);
assert.equal(planner.eligible.total, 60);
assert.equal(planner.percentages.directInOffice, 66.7);
assert.equal(planner.percentages.clinicalAdmin, 5);
assert.equal(planner.totals.estimatedPay, 4740);

assert.equal(logic.getProratedMonthCapHours(2026, 0), 265.7);
assert.equal(logic.getProratedMonthCapHours(2026, 1), 240);
assert.equal(logic.getProratedMonthCapHours(2028, 1), 248.6);

const rolling = logic.computeRolling28DaySummary([
  {
    date: "2026-04-01",
    minutes: { directInOffice: 480, directPhoneOutOfOffice: 0, indirectCare: 0, clinicalAdmin: 0 },
    notes: {},
  },
  {
    date: "2026-04-15",
    minutes: { directInOffice: 480, directPhoneOutOfOffice: 0, indirectCare: 0, clinicalAdmin: 0 },
    notes: {},
  },
  {
    date: "2026-04-29",
    minutes: { directInOffice: 480, directPhoneOutOfOffice: 0, indirectCare: 0, clinicalAdmin: 0 },
    notes: {},
  },
]);

assert.equal(rolling.peak.totalHours, 16);
assert.equal(rolling.latest.totalHours, 16);
assert.equal(rolling.latest.startDate, "2026-04-15");

const month = logic.computeMonthSummary(
  [
    {
      date: "2026-04-03",
      minutes: { directInOffice: 240, directPhoneOutOfOffice: 30, indirectCare: 60, clinicalAdmin: 15 },
      notes: {
        indirectSummary: "Inbox and lab review",
        clinicalSummary: "Team QI planning",
      },
    },
    {
      date: "2026-04-04",
      minutes: { directInOffice: 300, directPhoneOutOfOffice: 0, indirectCare: 75, clinicalAdmin: 15 },
      notes: {
        indirectSummary: "Forms and referrals",
        clinicalSummary: "EMR cleanup",
      },
    },
  ],
  "2026-04"
);

assert.equal(month.totals.actualHours, 12.3);
assert.equal(month.totals.billedHours, 12.3);
assert.equal(month.ratios.indirectAdminShare, 22.4);
assert.equal(month.ratios.clinicalShare, 4.1);
assert.equal(month.monthCapHours, 257.1);
assert.equal(month.counts.daysOverCap, 0);
assert.equal(month.plannerEquivalent.eligible.total, 12.3);

console.log("fho-hours logic checks passed");

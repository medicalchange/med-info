import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL("./logic.js", import.meta.url), "utf8"), context);
const logic = context.window.OsteoporosisRiskLogic;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log("PASS " + name); }
const base = { age: 65, sex: "male", majorRisk: 10, fnTScore: -1, contextReviewed: true };
const assess = changes => logic.buildAssessment({ ...base, ...changes });
check("blank assessment", () => assert.equal(logic.buildAssessment({}).category, "incomplete"));
check("T-score without FRAX remains incomplete", () => assert.equal(assess({ majorRisk: "" }).category, "incomplete"));
check("FRAX without BMD remains incomplete", () => assert.equal(assess({ fnTScore: "" }).category, "incomplete"));
check("negative conclusion requires history review", () => assert.equal(assess({ contextReviewed: false }).category, "incomplete"));
check("complete low threshold assessment", () => assert.equal(assess({}).category, "no-routine-treatment"));
check("15% boundary", () => assert.equal(assess({ majorRisk: 15 }).category, "suggest"));
check("20% boundary", () => assert.equal(assess({ majorRisk: 20 }).category, "recommend"));
check("age 69 T-score threshold", () => assert.equal(assess({ age: 69, fnTScore: -2.5, majorRisk: "" }).category, "suggest"));
check("age 70 T-score threshold", () => assert.equal(assess({ age: 70, fnTScore: -2.5, majorRisk: "" }).category, "recommend"));
check("independent fracture trigger without FRAX", () => assert.equal(assess({ priorHip: true, majorRisk: "", fnTScore: "" }).category, "recommend"));
check("age outside scope blocks advice", () => assert.equal(assess({ age: 45, priorHip: true }).category, "incomplete"));
check("premenopausal blocks advice", () => assert.equal(assess({ sex: "female", postmenopausal: "no", majorRisk: 25 }).category, "incomplete"));
check("unknown menopause blocks advice", () => assert.equal(assess({ sex: "female", postmenopausal: "unknown" }).category, "incomplete"));
check("invalid probability blocks advice", () => assert.equal(assess({ majorRisk: 101 }).category, "incomplete"));
check("negative probability blocks advice", () => assert.equal(assess({ majorRisk: -1 }).category, "incomplete"));
check("hip exceeding major probability blocks advice", () => assert.equal(assess({ hipRisk: 11 }).category, "incomplete"));
check("invalid numeric suffix rejected", () => assert.equal(logic.parseNumber("20abc"), null));
check("blank numbers stay missing", () => assert.equal(logic.parseNumber(" "), null));
check("ambiguous Z-score not parsed as T-score", () => assert.equal(logic.parseBmdReport("Total Hip BMD 0.8 Z-score -1.5").hipTScore, null));
check("sample report parses correctly", () => assert.equal(logic.parseBmdReport(logic.SAMPLE_BMD).fnTScore, -2.7));

// Exercise the real UI handlers without a browser dependency.
const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { value: "", checked: false, name: "", listeners: {},
    classList: { add() {} }, addEventListener(type, fn) { this.listeners[type] = fn; },
    scrollIntoView() {}, select() {} });
  return nodes.get(id);
}
for (const tag of html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
  const id = tag[0].match(/id="([^"]+)"/)?.[1];
  if (id) { const n = node(id); n.name = tag[0].match(/name="([^"]+)"/)?.[1] || ""; n.checkbox = tag[0].includes('type="checkbox"'); }
}
const form = node("osteo-form");
form.reset = () => { for (const n of nodes.values()) { n.value = ""; n.checked = false; } };
form.checkValidity = () => true;
class FormDataMock {
  get(name) { const n = [...nodes.values()].find(n => n.name === name); return n?.checkbox ? (n.checked ? "on" : null) : (n?.value ?? null); }
}
let pendingResponse;
Object.assign(context, {
  document: { querySelector: selector => node(selector.slice(1)) },
  FormData: FormDataMock, URLSearchParams, setTimeout,
  navigator: { clipboard: { writeText: async () => {} } },
  fetch: () => new Promise(resolve => { pendingResponse = resolve; }),
});
vm.runInContext(fs.readFileSync(new URL("./app.js", import.meta.url), "utf8"), context);
const inputReport = text => { node("bmd-input").value = text; node("bmd-input").listeners.input(); };
check("replacement report clears all previous patient state", () => {
  inputReport(logic.SAMPLE_BMD);
  node("prior-hip").checked = true;
  node("postmenopausal").value = "yes";
  inputReport("Age: 60\nSex: Male\nFemoral Neck BMD 0.800 T-score -1.0\nMajor osteoporotic fracture 5%");
  assert.equal(Number(node("age").value), 60);
  assert.equal(node("sex").value, "male");
  assert.equal(Number(node("major-risk").value), 5);
  assert.equal(node("hip-risk").value, "");
  assert.equal(node("hip-tscore").value, "");
  assert.equal(node("weight-kg").value, "");
  assert.equal(node("prior-hip").checked, false);
  assert.equal(node("postmenopausal").value, "");
});
check("manual correction remains until report changes", () => {
  node("fn-tscore").value = "-1.2";
  form.listeners.input({ target: node("fn-tscore") });
  assert.equal(node("fn-tscore").value, "-1.2");
  assert.equal(node("major-risk").value, "");
});
inputReport(logic.SAMPLE_BMD);
const pending = node("calculate-frax").listeners.click();
node("clear-form").listeners.click();
pendingResponse({ ok: true, json: async () => ({ majorRisk: 25, hipRisk: 5 }) });
await pending;
check("late FRAX response cannot overwrite cleared assessment", () => {
  assert.equal(node("major-risk").value, "");
  assert.equal(node("age").value, "");
  assert.equal(node("calculate-frax").disabled, false);
});
check("empty report clears recommendation", () => {
  inputReport("");
  assert.equal(node("result-title").textContent, "Assessment incomplete");
});
console.log("Passed " + checks + " osteoporosis checks.");

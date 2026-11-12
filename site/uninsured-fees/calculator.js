/* OMA January 2026 guide. Service definitions also render the static fee reference. */
(function(root) {
  "use strict";
  const node = typeof module !== "undefined" && module.exports;
  const services = node ? require("../_data/uninsured_fees.json") :
    JSON.parse(document.getElementById("fee-catalogue").textContent);
  const byId = new Map(services.map(service => [service.id, service]));
  function number(value, name, min, max, integer) {
    const n = Number(value);
    if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" ||
        !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
      throw new Error("Enter a valid " + name + ".");
    return n;
  }
  function calculate(input) {
    const service = byId.get(input.service);
    if (!service) throw new Error("Choose a service.");
    const lines = [];
    if (service.mode === "paper" || service.mode === "electronic") {
      const paper = service.mode === "paper";
      const pages = paper ? number(input.pages, "page count (1–100,000)", 1, 100000, true) : 0;
      lines.push({label: paper ? "Paper copy — first 20 pages" : "Secure electronic transfer", cents:3000});
      if (pages > 20) lines.push({label:(pages-20) + " additional pages × $0.25", cents:(pages-20)*25});
      if (input.includeReview) {
        const review = number(input.review, "review time (0–10,000 minutes)", 0, 10000, true);
        if (review > 15) lines.push({label:(review-15) + " additional review minutes × $3.00 (advance agreement required)", cents:(review-15)*300});
      }
    } else if (service.mode === "fixed") {
      lines.push({label:service.name, cents:service.cents});
    } else if (service.mode === "hourly" || service.mode === "timed") {
      const rateCents = service.mode === "timed" ? service.hourlyCents :
        Math.round(number(input.rate,"hourly rate (0–100,000 CAD)",0,100000,false)*100);
      const minutes = number(input.minutes,"time (1–10,000 minutes)",1,10000,true);
      const timeCents = Math.round(rateCents*minutes/60);
      const minimum = service.minimumCents || 0;
      lines.push({label:minutes + " minutes at $" + (rateCents/100).toFixed(2) + "/hour" +
        (service.mode === "timed" ? " (OMA suggested rate)" : " (your rate)"), cents:timeCents});
      if (timeCents < minimum) lines.push({label:"Adjustment to OMA suggested minimum of $" +
        (minimum/100).toFixed(2), cents:minimum-timeCents});
    } else if (service.mode === "custom") {
      lines.push({label:service.name + " (your fee)", cents:Math.round(number(input.amount,"fee (0–100,000 CAD)",0,100000,false)*100)});
    } else if (service.mode === "multiplier") {
      const baseCents = Math.round(number(input.base,"current OHIP fee (0–100,000 CAD)",0,100000,false)*100);
      lines.push({label:"Entered OHIP fee $" + (baseCents/100).toFixed(2) + " × 2.90", cents:Math.round(baseCents*290/100)});
    } else throw new Error("Choose a service.");
    return {lines,totalCents:lines.reduce((sum,line)=>sum+line.cents,0)};
  }
  const api = {calculate,services};
  if (node) module.exports = api;
  else root.UninsuredFees = api;
})(typeof window !== "undefined" ? window : globalThis);

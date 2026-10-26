/* OMA January 2026 guide, pp. 3, 16–19. Amounts calculated in cents. */
(function(root) {
  "use strict";
  const fixed = {note:2600, school:3725, fitness:4900};
  function number(value, name, min, max, integer) {
    const n = Number(value);
    if (value === "" || value == null || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
      throw new Error("Enter a valid " + name + ".");
    return n;
  }
  function calculate(input) {
    const lines = [];
    if (input.service === "paper" || input.service === "electronic") {
      const paper = input.service === "paper";
      const pages = paper ? number(input.pages, "page count (1–100,000)", 1, 100000, true) : 0;
      lines.push({label: paper ? "Paper copy — first 20 pages" : "Secure electronic transfer", cents:3000});
      if (pages > 20) lines.push({label:(pages-20) + " additional pages × $0.25", cents:(pages-20)*25});
      const review = number(input.review, "review time (0–10,000 minutes)", 0, 10000, true);
      if (input.includeReview && review > 15) lines.push({label:(review-15) + " additional review minutes × $3.00 (advance agreement required)", cents:(review-15)*300});
    } else if (Object.prototype.hasOwnProperty.call(fixed,input.service)) {
      lines.push({label:"Form / note completion",cents:fixed[input.service]});
    } else if (input.service === "hourly") {
      const rate = number(input.rate,"hourly rate (0–100,000 CAD)",0,100000,false);
      const minutes = number(input.minutes,"time (1–10,000 minutes)",1,10000,true);
      lines.push({label:minutes + " minutes at $" + rate.toFixed(2) + "/hour (your rate)",cents:Math.round(Math.round(rate*100)*minutes/60)});
    } else throw new Error("Choose a service.");
    return {lines,totalCents:lines.reduce((sum,line)=>sum+line.cents,0)};
  }
  if (typeof module !== "undefined" && module.exports) module.exports = {calculate};
  else root.UninsuredFees = {calculate};
})(typeof window !== "undefined" ? window : globalThis);

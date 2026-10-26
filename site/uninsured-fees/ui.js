(function() {
  "use strict";
  const form = document.getElementById("fee-form");
  const get = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(cents/100);
  function clear() {
    get("fee-total").textContent = "—";
    get("fee-breakdown").replaceChildren();
    get("fee-error").textContent = "";
  }
  function sync() {
    const service = get("service").value;
    const chart = service === "paper" || service === "electronic";
    [["paper-fields",service==="paper"],["chart-fields",chart],["hourly-fields",service==="hourly"]].forEach(([id,show])=>{
      get(id).hidden = !show;
      get(id).querySelectorAll("input").forEach(input=>{input.disabled=!show;});
    });
    get("forms-help").hidden = chart || service === "hourly";
    clear();
  }
  form.addEventListener("input",clear);
  get("service").addEventListener("change",sync);
  form.addEventListener("reset",()=>setTimeout(sync,0));
  form.addEventListener("submit",event=>{
    event.preventDefault();
    clear();
    try {
      const result = UninsuredFees.calculate({service:get("service").value,pages:get("pages").value,review:get("review").value,includeReview:get("include-review").checked,rate:get("rate").value,minutes:get("minutes").value});
      get("fee-total").textContent = money(result.totalCents);
      result.lines.forEach(line=>{
        const li=document.createElement("li");
        li.textContent=line.label + ": " + money(line.cents);
        get("fee-breakdown").append(li);
      });
    } catch(error) {get("fee-error").textContent=error.message;}
  });
  sync();
})();

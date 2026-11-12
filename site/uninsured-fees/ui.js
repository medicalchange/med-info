(function() {
  "use strict";
  const form = document.getElementById("fee-form");
  const get = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(cents/100);
  const services = new Map(UninsuredFees.services.map(service => [service.id, service]));
  function clear() {
    get("fee-total").textContent = "—";
    get("fee-breakdown").replaceChildren();
    get("fee-error").textContent = "";
  }
  function show(id, visible) {
    get(id).hidden = !visible;
    get(id).querySelectorAll("input").forEach(input => { input.disabled = !visible; });
  }
  function syncReview() {
    get("review").disabled = get("chart-fields").hidden || !get("include-review").checked;
  }
  function sync() {
    const service = services.get(get("service").value);
    const mode = service.mode;
    show("paper-fields", mode === "paper");
    show("chart-fields", mode === "paper" || mode === "electronic");
    show("hourly-fields", mode === "hourly" || mode === "timed");
    show("rate-field", mode === "hourly");
    show("custom-fields", mode === "custom");
    show("multiplier-fields", mode === "multiplier");
    get("amount").value = service.defaultCents == null ? "" : (service.defaultCents/100).toFixed(2);
    get("service-help").textContent = service.note;
    get("service-fee").textContent = service.fee;
    get("hourly-help").textContent = service.minimumCents ?
      "The estimate uses your time and rate, with an OMA suggested minimum of " + money(service.minimumCents) + ". Fees may be reduced or waived." :
      mode === "timed" ? "Calculated at the OMA suggested rate of " + money(service.hourlyCents) + "/hour, prorated by minute." :
      "Enter your own rate. OMA does not set a universal hourly fee.";
    syncReview();
    clear();
  }
  form.addEventListener("input",clear);
  get("include-review").addEventListener("change",syncReview);
  get("service").addEventListener("change",sync);
  form.addEventListener("reset",()=>setTimeout(sync,0));
  form.addEventListener("submit",event=>{
    event.preventDefault();
    clear();
    try {
      const result = UninsuredFees.calculate({
        service:get("service").value,pages:get("pages").value,review:get("review").value,
        includeReview:get("include-review").checked,rate:get("rate").value,
        minutes:get("minutes").value,amount:get("amount").value,base:get("base-fee").value
      });
      get("fee-total").textContent = money(result.totalCents);
      result.lines.forEach(line=>{
        const li=document.createElement("li");
        li.textContent=line.label + ": " + money(line.cents);
        get("fee-breakdown").append(li);
      });
    } catch(error) {get("fee-error").textContent=error.message;}
  });
  document.querySelectorAll("[data-service]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      get("service").value = link.dataset.service;
      sync();
      form.scrollIntoView({block:"start"});
      get("service").focus({preventScroll:true});
    });
  });
  const groups = [...document.querySelectorAll("[data-fee-group]")];
  const normalize = text => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ");
  function filter() {
    const terms = normalize(get("fee-search").value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    groups.forEach(group => {
      let visible = 0;
      group.querySelectorAll("tbody tr").forEach(row => {
        const text = normalize(group.querySelector("h3").textContent + " " + row.textContent + " " + row.querySelector("[data-service]").dataset.service);
        row.hidden = !terms.every(term => text.includes(term));
        if (!row.hidden) visible++;
      });
      group.hidden = visible === 0;
      count += visible;
    });
    get("fee-count").textContent = count + " of " + services.size + " services";
    get("fee-empty").hidden = count !== 0;
  }
  get("fee-search-controls").hidden = false;
  get("fee-search").addEventListener("input",filter);
  get("clear-search").addEventListener("click",()=>{
    get("fee-search").value = "";
    filter();
    get("fee-search").focus();
  });
  filter();
  sync();
})();

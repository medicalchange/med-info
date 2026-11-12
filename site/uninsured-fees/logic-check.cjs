const assert = require("node:assert/strict");
const {calculate,services} = require("./calculator.js");
let checks = 0;
function equal(a,b) { assert.equal(a,b); checks++; }
function rejects(input) { assert.throws(()=>calculate(input)); checks++; }
const chart = (pages,review=15,includeReview=false,service="paper") => calculate({service,pages,review,includeReview}).totalCents;
equal(services.length,35);
equal(new Set(services.map(s=>s.id)).size,35);
const fixed = {note:2600,communicable:2600,school:3725,admission:3725,fitness:4900,hospital:4900,
  "ei-sick":5200,"ei-care":7400,drivers:7700,foster:25200,"insurance-questionnaire":12500,
  "insurance-specific-exam":15200,"travel-cancel":16400,ocf3:26200,ocf18:27800,ocf19:15500,ocf23:26200};
for (const [service,cents] of Object.entries(fixed)) {
  equal(calculate({service}).totalCents,cents);
  equal(services.find(s=>s.id===service).fee,"$"+(cents/100).toFixed(2));
}
for (const [pages,cents] of [[1,3000],[20,3000],[21,3025],[100,5000],[100000,2502500]])
  equal(chart(pages),cents);
equal(chart(100,30,true),9500);
equal(chart(100,30,false),5000);
equal(chart(20,16,true),3300);
equal(chart(20,0,true),3000);
equal(chart("",30,true,"electronic"),7500);
equal(chart(1000,15,false,"electronic"),3000);
equal(chart(20,"",false),3000);
for(const pages of [""," ",null,0,-1,1.5,Infinity,NaN,100001,true])
  rejects({service:"paper",pages});
rejects({service:"paper",pages:20,includeReview:true,review:-1});
rejects({service:"paper",pages:20,includeReview:true,review:""});
equal(calculate({service:"hourly",rate:200,minutes:30}).totalCents,10000);
equal(calculate({service:"hourly",rate:100,minutes:1}).totalCents,167);
equal(calculate({service:"hourly",rate:0,minutes:30}).totalCents,0);
for(const [service,minimum] of [["dtc",15000],["aps",16000],["work-detailed",5000],["capacity",37600]]) {
  equal(calculate({service,rate:100,minutes:1}).totalCents,minimum);
  equal(calculate({service,rate:600,minutes:60}).totalCents,60000);
  const result=calculate({service,rate:100,minutes:1});
  equal(result.lines.reduce((sum,line)=>sum+line.cents,0),minimum);
}
for (const service of ["insurance-clarification","insurance-narrative"]) {
  equal(calculate({service,minutes:30}).totalCents,24850);
  equal(calculate({service,minutes:1}).totalCents,828);
  equal(calculate({service,minutes:60,rate:1}).totalCents,49700);
}
for (const service of ["missed","travel-vaccine","employment-tb"]) {
  equal(calculate({service,amount:"75.50"}).totalCents,7550);
  equal(calculate({service,amount:0}).totalCents,0);
  rejects({service,amount:""});
  rejects({service,amount:-1});
}
equal(services.find(s=>s.id==="employment-tb").defaultCents,7500);
equal(calculate({service:"assessment",base:50}).totalCents,14500);
equal(calculate({service:"assessment",base:"37.95"}).totalCents,11006);
for (const input of [
  {service:"hourly",rate:"",minutes:30},{service:"hourly",rate:-1,minutes:30},
  {service:"hourly",rate:100001,minutes:30},{service:"hourly",rate:200,minutes:0},
  {service:"hourly",rate:200,minutes:1.5},{service:"hourly",rate:200,minutes:10001},
  {service:"insurance-narrative",minutes:""},{service:"assessment",base:""},
  {service:"assessment",base:Infinity},{service:"unknown"},{service:"__proto__"}
]) rejects(input);
for (const s of services) {
  const result=calculate({service:s.id,pages:20,rate:200,minutes:30,amount:75,base:50});
  assert.ok(Number.isSafeInteger(result.totalCents) && result.totalCents >= 0,s.id);
  equal(result.lines.reduce((sum,line)=>sum+line.cents,0),result.totalCents);
}
console.log("PASS " + checks + " uninsured-fee checks: published rates, chart boundaries, hourly minima, custom fees, multiplier, rounding and validation");

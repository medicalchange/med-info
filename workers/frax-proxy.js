const UPSTREAM = "https://frax.canadiantaskforce.ca/proxy/";
const DEFAULT_ID = "9414574818";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function boolParam(value) {
  return value === "1" || value === "true" || value === "yes" || value === "on" ? "1" : "0";
}

function normalizeSex(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "1" || normalized === "female" || normalized === "f") return "1";
  if (normalized === "0" || normalized === "male" || normalized === "m") return "0";
  return null;
}

function extractXmlValue(xml, name) {
  const pattern = new RegExp(`<value\\s+name=["']${name}["']>(.*?)<\\/value>`, "i");
  const match = xml.match(pattern);
  return match ? match[1].trim() : "";
}

async function getInputParams(request) {
  if (request.method === "GET") {
    return new URL(request.url).searchParams;
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      return new URLSearchParams(Object.entries(body).map(([key, value]) => [key, value == null ? "" : String(value)]));
    }
    const body = await request.text();
    return new URLSearchParams(body);
  }

  return null;
}

function buildUpstreamParams(input) {
  const age = parseNumber(input.get("age"));
  const weight = parseNumber(input.get("weight"));
  const height = parseNumber(input.get("height"));
  const sex = normalizeSex(input.get("sex"));
  const bmd = input.get("bmd") === "1" || input.get("bmd") === "tscore" ? "1" : "N/A";
  const score = parseNumber(input.get("score"));

  const missing = [];
  if (age == null) missing.push("age");
  if (sex == null) missing.push("sex");
  if (weight == null) missing.push("weight");
  if (height == null) missing.push("height");
  if (bmd === "1" && score == null) missing.push("score");
  if (missing.length) {
    return { error: `Missing or invalid required parameter(s): ${missing.join(", ")}` };
  }

  if (age < 40 || age > 90) {
    return { error: "FRAX accepts age from 40 to 90 years." };
  }

  const params = new URLSearchParams({
    ethnicity: "19",
    age: String(age),
    sex,
    weight: String(weight),
    height: String(height),
    previousfracture: boolParam(input.get("previousfracture")),
    pfracturehip: boolParam(input.get("pfracturehip")),
    currentsmoker: boolParam(input.get("currentsmoker")),
    glucocorticoids: boolParam(input.get("glucocorticoids")),
    arthritis: boolParam(input.get("arthritis")),
    osteoporosis: boolParam(input.get("osteoporosis")),
    alcohol: boolParam(input.get("alcohol")),
    bmd,
    ID: input.get("ID") || DEFAULT_ID,
  });

  if (bmd === "1") {
    params.set("score", String(score));
  }

  return { params, usedBmd: bmd === "1" };
}

async function handle(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const input = await getInputParams(request);
  const built = buildUpstreamParams(input);
  if (built.error) {
    return jsonResponse({ error: built.error }, 400);
  }

  const upstreamUrl = `${UPSTREAM}?${built.params.toString()}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  const xml = await upstream.text();

  if (!upstream.ok) {
    return jsonResponse({ error: "Canadian FRAX endpoint failed", status: upstream.status }, 502);
  }

  const bmi = parseNumber(extractXmlValue(xml, "bmi"));
  const majorRisk = parseNumber(extractXmlValue(xml, built.usedBmd ? "rs3" : "rs1"));
  const hipRisk = parseNumber(extractXmlValue(xml, built.usedBmd ? "rs4" : "rs2"));

  if (majorRisk == null || hipRisk == null) {
    return jsonResponse({
      error: "Canadian FRAX endpoint did not return risk values",
      usedBmd: built.usedBmd,
    }, 502);
  }

  return jsonResponse({
    bmi,
    majorRisk,
    hipRisk,
    usedBmd: built.usedBmd,
    source: "Canadian Task Force FRAX proxy / FRAXplus calculation",
  });
}

export default { fetch: handle };

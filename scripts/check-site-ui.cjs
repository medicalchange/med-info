/* Render the built site and verify shared presentation at desktop and mobile widths. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const root = path.resolve("_site");
const output = path.resolve("ui-checks");
fs.mkdirSync(output, { recursive: true });
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf" };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end(); return; }
  let file = path.resolve(root, "." + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Use a fixed synthetic shortage response; layout checks must not depend on the live feed.
    await page.route("https://raw.githubusercontent.com/medicalchange/drug-shortage-feed/**", route =>
      route.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, json: { refreshedAt: "2026-10-26T12:00:00Z", results: [
        { drug: "Synthetic test product", doses: ["10 mg"], expectedBackInStockDate: "2026-11-01" }
      ], addedDrugs: [], addedHistory: [] } }));
    await page.route("https://gc.zgo.at/**", route => route.fulfill({ body: "", contentType: "text/javascript" }));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const routes = ["/", "/cv-risk/", "/osteoporosis-risk/", "/shortages/", "/palliative-resources/", "/interesting-links/", "/diet-resources/"];
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        const response = await page.goto(base + route);
        assert.equal(response.status(), 200, route + " loads");
        await page.locator(".site-header").waitFor();
        const actual = await page.evaluate(() => ({
          font: getComputedStyle(document.body).fontFamily,
          background: getComputedStyle(document.body).backgroundColor,
          nav: document.querySelectorAll(".site-nav a").length,
          h1: document.querySelectorAll("h1").length,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          stylesheet: [...document.styleSheets].some(s => s.href && s.href.includes("/assets/site.css")),
          main: !!document.getElementById("main-content"),
          rawLiquid: document.body.innerHTML.includes("{%") || document.body.innerHTML.includes("{{"),
          duplicateIds: [...document.querySelectorAll("[id]")].map(e => e.id).filter((id, i, ids) => ids.indexOf(id) !== i),
          grid: document.querySelector(".grid") ? getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length : null,
        }));
        assert.equal(actual.nav, 4, route + " shared navigation");
        assert.equal(actual.h1, 1, route + " one primary heading");
        assert.equal(actual.background, "rgb(244, 247, 246)", route + " shared background");
        assert.match(actual.font, /Segoe UI/, route + " shared typography");
        assert.equal(actual.overflow, false, route + " no horizontal overflow at " + width);
        assert.equal(actual.stylesheet, true, route + " shared stylesheet");
        assert.equal(actual.main, true, route + " skip-link target");
        assert.equal(actual.rawLiquid, false, route + " templates rendered");
        assert.deepEqual(actual.duplicateIds, [], route + " unique IDs");
        if (actual.grid !== null) assert.equal(actual.grid, width <= 1000 ? 1 : 2, route + " responsive tool columns");
        if (width === 1440 || width === 390) {
          const name = (route === "/" ? "home" : route.replaceAll("/", "")) + "-" + width;
          await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
        }
        console.log("PASS " + route + " at " + width + "px");
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/osteoporosis-risk/");
    await page.locator("#load-sample").click();
    await page.locator("#postmenopausal").selectOption("yes");
    await page.locator("#treatment-status").selectOption("none");
    assert.equal(await page.locator("#result-title").textContent(), "Recommend pharmacotherapy");
    await page.locator("#treatment-status").selectOption("prior");
    assert.equal(await page.locator("#result-title").textContent(), "Treatment review required");
    await page.locator("#clear-form").click();
    assert.equal(await page.locator("#age").inputValue(), "");
    await page.goto(base + "/cv-risk/");
    await page.locator("#load-sample").click();
    await page.locator('button[type="submit"]').click();
    assert.ok((await page.locator("#metrics-grid").textContent()).trim().length > 0, "CV sample renders");
    await page.locator("#clear-form").click();
    assert.equal(await page.locator("#lab-input").inputValue(), "");
    await page.goto(base + "/shortages/");
    await page.locator("#shortage-search").fill("no-matching-product");
    await page.getByText("No active shortages found for this search.").waitFor();
    await page.goto(base + "/");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".skip-link").evaluate(e => e === document.activeElement), true, "keyboard skip link");
    assert.deepEqual(errors, [], "no browser JavaScript errors");
    console.log("PASS calculator samples, reset controls, shortage search and keyboard navigation");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

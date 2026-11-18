/* Track resource use, never form values, reports, calculated results or clipboard content. */
(function () {
  "use strict";

  if (!["medicallinks.ca", "www.medicallinks.ca"].includes(window.location.hostname)) return;

  function track(name, properties) {
    if (!window.umami || typeof window.umami.track !== "function") return;
    try {
      const request = window.umami.track(name, { page: window.location.pathname, ...properties });
      if (request && typeof request.catch === "function") request.catch(function () {});
    } catch (_) {
      // An unavailable analytics service must not interfere with the website.
    }
  }

  function onClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    const element = target && target.closest("a[href], [data-analytics-action]");
    if (!element || element.closest("[data-analytics-ignore], [data-umami-event]")) return;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") return;

    const action = element.getAttribute("data-analytics-action");
    if (action) {
      if (event.type === "click") track("Button click", { action: action });
      return;
    }

    const href = element.getAttribute("href");
    if (!href || !href.trim()) return;
    let destination;
    try { destination = new URL(href, window.location.href); } catch (_) { return; }

    // Labels come only from public link text; the analytics code never reads inputs.
    const label = (element.getAttribute("aria-label") || element.textContent || "")
      .replace(/\s+/g, " ").trim().slice(0, 160);
    if (destination.protocol === "tel:" || destination.protocol === "mailto:") {
      // Count contact clicks without transmitting phone numbers or email addresses.
      track(destination.protocol === "tel:" ? "Phone link" : "Email link", {});
      return;
    }
    if (!["https:", "http:"].includes(destination.protocol)) return;

    // Deliberately omit query strings, fragments, and embedded credentials.
    const url = destination.origin + destination.pathname;
    const internal = ["medicallinks.ca", "www.medicallinks.ca"].includes(destination.hostname);
    let name = internal ? "Internal link" : "External link";
    if (/\.pdf$/i.test(destination.pathname)) name = "PDF click";
    else if (element.hasAttribute("download")) name = "File click";
    else if (internal && destination.pathname === window.location.pathname && destination.hash) name = "Section link";
    track(name, { url: url, label: label });
  }

  // Capture before application handlers, without preventing navigation or changing their behavior.
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  document.addEventListener("submit", function (event) {
    const action = event.target.getAttribute("data-analytics-submit");
    if (action) track("Tool use", { action: action });
  }, true);
})();

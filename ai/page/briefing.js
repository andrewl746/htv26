// The shareable ward briefing (MASTERSPEC 7.7). Plain JavaScript, no build step, no external libraries.
// Every user-facing string comes from /static/copy/*.json or the BriefingResponse; nothing is typed here.
"use strict";

(async function main() {
  const S = window.SUPLEX;
  const params = new URLSearchParams(location.search);
  const fixtureMode = params.get("fixture") === "1";
  const page = document.getElementById("page");
  const status = document.getElementById("status");
  const SVG_NS = "http://www.w3.org/2000/svg";

  async function getJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children) if (child !== null && child !== undefined) node.append(child);
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  let labels;
  try {
    labels = await getJSON("/static/copy/labels.json");
  } catch {
    status.textContent = "Suplex";  // copy itself failed to load; nothing else can be shown
    return;
  }
  const P = labels.briefing_page;
  const UI = labels.ui;
  status.textContent = P.loading;

  // Ward data: the API, or the fixtures with ?fixture=1 or when the API is down (MASTERSPEC 3.1).
  async function wardData() {
    const fixtures = async () => ({
      ward: await getJSON(`/static/fixtures/ward.${S.wardId}.json`),
      trend: await getJSON(`/static/fixtures/trend.${S.wardId}.json`).catch(() => null),
      sample: true,
    });
    if (fixtureMode) return fixtures();
    try {
      const ward = await getJSON(`${S.apiUrl}/ward/${S.wardId}`);
      const trend = await getJSON(`${S.apiUrl}/ward/${S.wardId}/trend`).catch(() => null);
      return { ward, trend, sample: false };
    } catch {
      return fixtures();
    }
  }

  let data, briefing, notChecked, config;
  try {
    data = await wardData();
    [briefing, notChecked, config] = await Promise.all([
      getJSON("/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ward: data.ward, trend: data.trend, lang: S.lang }),
      }),
      getJSON("/static/copy/not_checked.json"),
      getJSON("/static/engine_config.json"),
    ]);
  } catch (error) {
    console.error(error);
    status.textContent = P.error;
    return;
  }

  const textLang = briefing.translation_unavailable ? "en" : briefing.lang;
  document.documentElement.lang = textLang;
  document.title = briefing.title;

  function intl(lang) {
    try { return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }); }
    catch { return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }); }
  }
  const numberFormat = intl(textLang);
  const formatDate = (iso, options) => {
    try { return new Intl.DateTimeFormat(textLang, options).format(new Date(iso)); }
    catch { return iso; }
  };

  // Each {{key}} becomes a link to its source; the footnote number is used in print.
  const footnotes = new Map();
  function richText(template) {
    const fragment = document.createDocumentFragment();
    template.split(/\{\{([a-z0-9_]+)\}\}/).forEach((part, i) => {
      if (i % 2 === 0) { fragment.append(part); return; }
      const entry = briefing.numbers[part];
      if (!entry) { fragment.append(part); return; }
      if (!footnotes.has(part)) footnotes.set(part, footnotes.size + 1);
      fragment.append(el("a", {
        class: "num", href: entry.source_url, title: entry.label, "data-fn": footnotes.get(part),
        text: numberFormat.format(entry.value),
      }));
    });
    return fragment;
  }

  // --- header and toolbar ---------------------------------------------------------------------
  const latestData = Object.values(briefing.data_dates || {}).sort().pop();
  const header = el("header", {},
    el("p", { class: "brand", text: "Suplex" }),
    el("h1", { text: briefing.title }),
    el("p", { class: "meta" },
      el("span", { text: `${P.generated} ${formatDate(briefing.generated_at, { dateStyle: "long" })}` }),
      latestData ? el("span", { text: `${P.data_as_of} ${formatDate(`${latestData}T12:00:00`, { dateStyle: "long" })}` }) : null,
      el("span", { class: "badge", text: briefing.source === "gemini" ? UI.source_gemini : UI.source_template }),
    ),
  );

  const notices = [];
  if (data.sample) notices.push(el("p", { class: "notice sample", role: "note", text: P.fixture_notice }));
  if (briefing.translation_unavailable) notices.push(el("p", { class: "notice", role: "note", text: UI.translation_unavailable }));

  const select = el("select", { id: "lang", onchange: () => {
    const next = new URLSearchParams(location.search);
    next.set("lang", select.value);
    location.search = next.toString();
  } });
  for (const code of S.langs) {
    const name = labels.languages[code] ? labels.languages[code].native : code;
    select.append(el("option", { value: code, selected: code === S.lang, text: name }));
  }

  const copyButton = el("button", { type: "button", class: "primary", text: UI.copy, onclick: async () => {
    const parts = [briefing.title, ""];
    for (const section of briefing.sections) parts.push(section.heading, section.text, "");
    parts.push(briefing.disclaimer, "", location.href);
    const plain = parts.join("\n");
    try {
      await navigator.clipboard.writeText(plain);
    } catch {
      const area = el("textarea", { class: "no-print" });
      area.value = plain;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    copyButton.textContent = UI.copied;
    setTimeout(() => { copyButton.textContent = UI.copy; }, 2000);
  } });

  const toolbar = el("div", { class: "toolbar" },
    el("label", { for: "lang", text: P.language }), select,
    copyButton,
    el("button", { type: "button", text: P.print, onclick: () => window.print() }),
    el("a", { href: briefing.links.ward_map, text: P.ward_map_link }),
  );

  // --- sections -------------------------------------------------------------------------------
  const sections = briefing.sections.map((section) => {
    const body = section.id === "questions"
      ? el("ol", {}, ...briefing.questions.map((q) => el("li", { text: q })))
      : el("p", {}, richText(section.template_text));
    return el("section", { class: "card", id: section.id }, el("h2", { text: section.heading }), body);
  });

  // --- trend chart: one series, so no legend; the heading names it (dataviz marks spec) --------
  function trendChart(trend) {
    const series = trend.series;
    const W = 720, H = 240, M = { top: 34, right: 12, bottom: 26, left: 34 };
    const innerW = W - M.left - M.right, innerH = H - M.top - M.bottom;
    const max = Math.max(1, ...series.map((p) => p.permits));
    const step = Math.max(1, Math.ceil(max / 4));
    const yMax = Math.ceil(max / step) * step;
    const band = innerW / series.length;
    const barW = Math.min(24, Math.max(1, band - 2));  // 2px surface gap between bars
    const x = (i) => M.left + i * band + (band - barW) / 2;
    const y = (v) => M.top + innerH - (v / yMax) * innerH;
    const monthName = (month) => formatDate(`${month}-15T12:00:00`, { month: "short", year: "numeric" });
    const tooltipText = (p) => (p.permits === 1 ? P.trend_tooltip_one : P.trend_tooltip_other)
      .replace("{month}", monthName(p.month)).replace("{count}", numberFormat.format(p.permits));

    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${P.trend_heading}. ${UI.trend_caption}` });
    for (let v = 0; v <= yMax; v += step) {
      chart.append(svg("line", { class: "grid", x1: M.left, x2: W - M.right, y1: y(v), y2: y(v) }));
      const label = svg("text", { class: "axis-text", x: M.left - 6, y: y(v) + 4, "text-anchor": "end" });
      label.textContent = numberFormat.format(v);
      chart.append(label);
    }
    series.forEach((p, i) => {
      if (p.month.endsWith("-01")) {
        const label = svg("text", { class: "axis-text", x: M.left + i * band, y: H - 8 });
        label.textContent = p.month.slice(0, 4);
        chart.append(label);
      }
    });
    for (const marker of trend.markers || []) {
      const i = series.findIndex((p) => p.month === marker.month);
      if (i < 0) continue;
      const mx = M.left + i * band + band / 2;
      chart.append(svg("line", { class: "marker", x1: mx, x2: mx, y1: M.top - 14, y2: M.top + innerH }));
      const nearEnd = i > series.length * 0.7;
      const label = svg("text", { class: "marker-text", x: nearEnd ? mx - 4 : mx + 4, y: M.top - 18,
                                  "text-anchor": nearEnd ? "end" : "start" });
      label.textContent = marker.label;
      chart.append(label);
    }

    const wrap = el("div", { class: "chart" });
    const tooltip = el("div", { class: "tooltip", hidden: true });
    series.forEach((p, i) => {
      let bar = null;
      if (p.permits > 0) {
        const top = y(p.permits), h = M.top + innerH - top, r = Math.min(4, h, barW / 2), bx = x(i);
        bar = svg("path", { class: "bar", d:
          `M${bx},${top + h}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barW - r}` +
          `Q${bx + barW},${top} ${bx + barW},${top + r}V${top + h}Z` });  // rounded data end, square baseline
        chart.append(bar);
      }
      const hit = svg("rect", { class: "hit", x: M.left + i * band, y: M.top, width: band, height: innerH });
      hit.addEventListener("pointerenter", () => {
        if (bar) bar.classList.add("active");
        tooltip.textContent = tooltipText(p);
        tooltip.hidden = false;
        const box = chart.getBoundingClientRect(), scale = box.width / W;
        tooltip.style.left = `${(M.left + i * band + band / 2) * scale}px`;
        tooltip.style.top = `${y(p.permits) * scale}px`;
      });
      hit.addEventListener("pointerleave", () => { if (bar) bar.classList.remove("active"); tooltip.hidden = true; });
      chart.append(hit);
    });
    wrap.append(chart, tooltip);

    const table = el("table", {},
      el("thead", {}, el("tr", {}, el("th", { text: P.trend_month }), el("th", { text: P.trend_permits }))),
      el("tbody", {}, ...series.map((p) => el("tr", {},
        el("td", { text: monthName(p.month) }), el("td", { text: numberFormat.format(p.permits) })))),
    );
    return el("section", { class: "card", id: "trend" },
      el("h2", { text: P.trend_heading }),
      wrap,
      el("p", { class: "caption" }, UI.trend_caption, " ",
         trend.source === "cache" ? el("span", { class: "badge", text: P.trend_source_cache }) : null),
      el("details", {}, el("summary", { text: P.trend_table }), table),
    );
  }

  // --- sources and methodology ----------------------------------------------------------------
  const sources = el("section", { class: "card sources", id: "sources" },
    el("h2", { text: P.sources_heading }),
    el("ol", {}, ...[...footnotes.keys()].map((key) => {
      const entry = briefing.numbers[key];
      return el("li", {}, `${entry.label}: `, el("a", { href: entry.source_url, text: entry.source_url }));
    })),
  );

  const fill = (text) => text
    .replace("{band_m}", numberFormat.format(config.uncertainty_band_m))
    .replace("{band_pp}", numberFormat.format(config.uncertainty_band_coverage_pp));
  const methodology = el("footer", { class: "card methodology", id: "methodology" },
    el("h2", { text: P.methodology_heading }),
    ...P.methodology.map((text) => el("p", { text: fill(text) })),
    el("h3", { text: P.not_checked_heading }),
    el("ul", {}, ...notChecked.map((item) => el("li", { text: item.label }))),
    el("h3", { text: P.datasets_heading }),
    el("ul", {}, ...briefing.links.datasets.map((d) => el("li", {}, el("a", { href: d.url, text: d.label })))),
  );

  const hasTrend = data.trend && data.trend.series && data.trend.series.length > 0;
  page.replaceChildren(...[
    header, ...notices, toolbar, ...sections,
    hasTrend ? trendChart(data.trend) : null,
    el("p", { class: "disclaimer", text: briefing.disclaimer }),
    sources, methodology,
  ].filter(Boolean));
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();

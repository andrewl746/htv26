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
  // Page copy in a language: its block in labels.json (labels.fr) over the English; a missing key stays English.
  function copyIn(lang) {
    const own = labels[lang] || {};
    return [{ ...labels.briefing_page, ...own.briefing_page }, { ...labels.ui, ...own.ui }];
  }
  let [P, UI] = copyIn(S.lang);
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
  [P, UI] = copyIn(textLang);  // the page's own words in the language its text is shown in
  // The API sends the trend markers in English; show them in the page's language.
  const markerText = new Map([
    [labels.ui.trend_marker_citywide, UI.trend_marker_citywide],
    [labels.ui.trend_marker_designs, UI.trend_marker_designs],
  ]);
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
  // The dates sit in a title block under the title, like a drawing's.
  const cell = (term, value) => el("div", {}, el("dt", { text: term }), el("dd", {}, value));
  const header = el("header", { class: "sheet-head" },
    el("p", { class: "brand", text: "Suplex" }),
    el("h1", { text: briefing.title }),
    el("dl", { class: "title-block" },
      cell(P.generated, formatDate(briefing.generated_at, { dateStyle: "long" })),
      latestData ? cell(P.data_as_of, formatDate(`${latestData}T12:00:00`, { dateStyle: "long" })) : null,
      el("div", { class: "title-block-source" },
        el("span", { class: "badge", text: briefing.source === "gemini" ? UI.source_gemini : UI.source_template })),
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

  // A small line icon in the sheet's teal, drawn on a 16-unit grid; decorative, so hidden from readers.
  const ICONS = {
    copy: "M5.5 5.5h7v8h-7zM3.5 10.5v-8h7",
    print: "M4.5 6.5v-4h7v4M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z",
    map: "M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5zM5.5 2v10M10.5 4v10",
  };
  function icon(name) {
    const mark = svg("svg", { class: "icon", viewBox: "0 0 16 16", "aria-hidden": "true" });
    mark.append(svg("path", { d: ICONS[name] }));
    return mark;
  }
  const copyLabel = el("span", { text: UI.copy });
  const copyButton = el("button", { type: "button", class: "primary", onclick: async () => {
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
    copyLabel.textContent = UI.copied;
    setTimeout(() => { copyLabel.textContent = UI.copy; }, 2000);
  } }, icon("copy"), copyLabel);

  // Whether a speaker has reviewed the language actually shown (English when the translation is unavailable).
  const shown = labels.languages[textLang];
  const reviewBadge = el("span", {
    class: shown && shown.reviewed ? "badge review reviewed" : "badge review",
    id: "review-status",
    text: shown && shown.reviewed ? P.review_reviewed : P.review_machine,
  });
  select.setAttribute("aria-describedby", "review-status");

  // One ruled strip: the language and its review status on the left, the actions on the right.
  const toolbar = el("div", { class: "toolbar" },
    el("div", { class: "lang-picker" },
      el("label", { for: "lang", text: P.language }),
      el("span", { class: "select-wrap" }, select),
      reviewBadge,
    ),
    el("div", { class: "actions" },
      copyButton,
      el("button", { type: "button", onclick: () => window.print() }, icon("print"), el("span", { text: P.print })),
      el("a", { class: "button-link", href: briefing.links.ward_map }, icon("map"), el("span", { text: P.ward_map_link })),
    ),
  );

  // --- sections -------------------------------------------------------------------------------
  // Each written section is a note on the sheet, numbered like a drawing's callouts; the questions
  // run the full width under them.
  const sections = briefing.sections.map((section, i) => {
    const questions = section.id === "questions";
    const body = questions
      ? el("ol", {}, ...briefing.questions.map((q) => el("li", { text: q })))
      : el("p", {}, richText(section.template_text));
    return el("section", { class: questions ? "note note-wide" : "note", id: section.id },
      el("h2", {}, el("span", { class: "callout", "aria-hidden": "true", text: String(i + 1) }), section.heading),
      body);
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
      label.textContent = markerText.get(marker.label) || marker.label;
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
    return el("section", { class: "block", id: "trend" },
      el("h2", { class: "section-title", text: P.trend_heading }),
      wrap,
      el("p", { class: "caption" }, UI.trend_caption, " ",
         trend.source === "cache" ? el("span", { class: "badge", text: P.trend_source_cache }) : null),
      el("details", {}, el("summary", { text: P.trend_table }), table),
    );
  }

  // --- sources and methodology ----------------------------------------------------------------
  const sources = el("section", { class: "block sources", id: "sources" },
    el("h2", { class: "section-title", text: P.sources_heading }),
    el("ol", {}, ...[...footnotes.keys()].map((key) => {
      const entry = briefing.numbers[key];
      return el("li", {}, `${entry.label}: `, el("a", { href: entry.source_url, text: entry.source_url }));
    })),
  );

  const fill = (text) => text
    .replace("{band_m}", numberFormat.format(config.uncertainty_band_m))
    .replace("{band_pp}", numberFormat.format(config.uncertainty_band_coverage_pp));
  const methodology = el("footer", { class: "block methodology", id: "methodology" },
    el("h2", { class: "section-title", text: P.methodology_heading }),
    ...P.methodology.map((text) => el("p", { text: fill(text) })),
    el("h3", { text: P.not_checked_heading }),
    el("ul", {}, ...notChecked.map((item) => el("li", { text: item[`label_${textLang}`] || item.label }))),
    el("h3", { text: P.datasets_heading }),
    el("ul", {}, ...briefing.links.datasets.map((d) => el("li", {}, el("a", { href: d.url, text: d.label })))),
  );

  const hasTrend = data.trend && data.trend.series && data.trend.series.length > 0;
  // A teal rule between each two groups, running from one inner rule of the sheet to the other.
  const rule = () => el("hr", { class: "sheet-rule" });
  page.replaceChildren(...[
    header, ...notices, toolbar, rule(),
    el("div", { class: "notes" }, ...sections),
    el("p", { class: "disclaimer", text: briefing.disclaimer }),
    hasTrend ? rule() : null,
    hasTrend ? trendChart(data.trend) : null,
    rule(), sources, rule(), methodology,
  ].filter(Boolean));
  window.suplexBlueprint?.(page);
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();

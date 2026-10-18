// The briefing's drafting sheet, after web/src/components/Landing/Blueprint.tsx (the landing card and
// the result panel): a quarter-unit grid, a double-ruled frame with ticks on every edge and numerals
// along the top and bottom, and registration marks at the inner corners. Drawn behind every element
// with class "sheet" and redrawn whenever it changes size. Colours come from briefing.css (.bp-*).
"use strict";

(function blueprint() {
  const SVG_NS = "http://www.w3.org/2000/svg";
  // The ruled area's inset from the sheet's edge, as on the result panel (the outer rule is the edge).
  const INNER = 20;
  const CARD_RX = 12;
  const UNIT = 32;
  const MINOR = UNIT / 4;
  const TICK = 3;
  const TICK_MAJOR = 7;
  const MARK_R = 5;
  const MARK_ARM = 10;

  const r2 = (n) => Math.round(n * 100) / 100;

  function node(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }

  function draw(layer, w, h) {
    const x0 = INNER, y0 = INNER, x1 = w - INNER, y1 = h - INNER;
    layer.replaceChildren();
    if (x1 - x0 < UNIT || y1 - y0 < UNIT) return;
    const id = layer.dataset.id;
    const tickLen = (i) => (i % 4 === 0 ? TICK_MAJOR : TICK);

    // Like a real sheet, everything counts from the ruled area's bottom-left corner.
    let ticks = "";
    for (let i = 0; x0 + i * MINOR <= x1 + 0.01; i++) {
      const x = r2(x0 + i * MINOR) + 0.5;
      ticks += `M${x} ${y0}v${-tickLen(i)}M${x} ${y1}v${tickLen(i)}`;
    }
    for (let i = 0; y1 - i * MINOR >= y0 - 0.01; i++) {
      const y = r2(y1 - i * MINOR) + 0.5;
      ticks += `M${x0} ${y}h${-tickLen(i)}M${x1} ${y}h${tickLen(i)}`;
    }
    let minor = "";
    for (let i = 1; i < 4; i++) minor += `M${i * MINOR + 0.5} 0V${UNIT}M0 ${i * MINOR + 0.5}H${UNIT}`;

    const corners = [x0 + 0.5, x1 - 0.5].flatMap((x) => [y0 + 0.5, y1 - 0.5].map((y) => [x, y]));
    const marks = corners.map(([x, y]) => `M${x - MARK_ARM} ${y}h${2 * MARK_ARM}M${x} ${y - MARK_ARM}v${2 * MARK_ARM}`).join("");

    const svg = node("svg", { width: w, height: h });
    const pattern = node("pattern", { id: `${id}-grid`, patternUnits: "userSpaceOnUse", x: x0, y: y1, width: UNIT, height: UNIT });
    pattern.append(node("path", { class: "bp-minor", d: minor }), node("path", { class: "bp-major", d: `M0.5 0V${UNIT}M0 0.5H${UNIT}` }));
    const defs = node("defs", {});
    defs.append(pattern);
    svg.append(defs, node("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: `url(#${id}-grid)` }));

    const rules = node("g", { class: "bp-rule", fill: "none" });
    rules.append(
      node("rect", { x: 0.5, y: 0.5, width: w - 1, height: h - 1, rx: CARD_RX }),
      node("rect", { x: x0 + 0.5, y: y0 + 0.5, width: x1 - x0 - 1, height: y1 - y0 - 1 }),
      node("path", { d: ticks }),
    );
    const mark = node("g", { class: "bp-mark", fill: "none" });
    mark.append(node("path", { d: marks }), ...corners.map(([x, y]) => node("circle", { cx: x, cy: y, r: MARK_R })));

    // Numerals in the band along the top and bottom, one per unit.
    const numerals = node("g", { class: "bp-numeral", "text-anchor": "middle", "dominant-baseline": "central" });
    const cols = Math.floor((x1 - x0) / UNIT + 0.01);
    const topRow = (y0 - TICK_MAJOR) / 2;
    const bottomRow = (y1 + TICK_MAJOR + h) / 2;
    for (let k = 0; k <= cols; k++) {
      for (const y of [topRow, bottomRow]) {
        const t = node("text", { x: x0 + k * UNIT, y });
        t.textContent = String(k);
        numerals.append(t);
      }
    }
    svg.append(rules, mark, numerals);
    layer.append(svg);
  }

  let count = 0;
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const sheet = entry.target;
      const layer = sheet.querySelector(":scope > .bp");
      draw(layer, Math.round(sheet.offsetWidth), Math.round(sheet.offsetHeight));
    }
  });

  /** Gives `sheet` its drawing, kept to its size from now on. */
  window.suplexBlueprint = function attach(sheet) {
    const layer = document.createElement("div");
    layer.className = "bp";
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.id = `bp${count++}`;
    sheet.prepend(layer);
    observer.observe(sheet);
  };
})();

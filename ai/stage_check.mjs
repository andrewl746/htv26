// Stage dry run: every request the demo makes, the way the browser makes it, with Gemini unreachable.
// Posts with JSON.stringify, as the browser does, so the cache keys are tested the way the stage will hit them.
// usage, with the API and AI service running on the demo laptop: node ai/stage_check.mjs [apiUrl] [aiUrl]
// Expected results are pitch/demo.md's three addresses and the locked Ward 04 headline.
const API = process.argv[2] || "http://localhost:8000";
const AI = process.argv[3] || "http://localhost:8001";
const EXPECT = {
  "326 Quebec Ave": { id: "7986858", results: ["fits", "fits", "fits", "fits"] },
  "281 Armadale Ave": { id: "7955411", results: ["borderline", "no_fit", "no_fit", "no_fit"] },
  "155 Vine Ave": { id: "9085619", results: ["no_fit", "no_fit", "no_fit", "no_fit"] },
};
let failures = 0;
const slow = [];
function ok(cond, what) {
  if (!cond) { failures++; console.log("  FAIL", what); }
}
async function timed(url, init) {
  const t = performance.now();
  const r = await fetch(url, init);
  const ms = performance.now() - t;
  if (ms > 2000) slow.push(`${Math.round(ms)} ms ${url}`);
  ok(r.ok, `${r.status} ${url}`);
  const type = r.headers.get("content-type") || "";
  return { body: type.includes("json") ? await r.json() : await r.text(), ms, headers: r.headers };
}
const post = (url, body) => timed(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

for (const [typed, want] of Object.entries(EXPECT)) {
  console.log(typed);
  // autocomplete, one request per keystroke from the third character
  let found = null;
  for (let n = 3; n <= typed.length; n++) {
    const { body } = await timed(`${API}/search?q=${encodeURIComponent(typed.slice(0, n))}`);
    found = body.results.find((r) => r.address_id === want.id) || found;
  }
  ok(found, `autocomplete never offered address_id ${want.id}`);
  const { body: check, ms } = await timed(`${API}/check?address_id=${want.id}`);
  const results = check.designs.map((d) => d.result);
  ok(JSON.stringify(results) === JSON.stringify(want.results), `results ${results} (expected ${want.results})`);
  console.log(`  check ${Math.round(ms)} ms: ${results.join(" / ")}`);
  for (const lang of ["en", "fr"]) {
    for (const d of check.designs) {
      const { body: ex } = await post(`${AI}/explain`, { check, design_id: d.design_id, lang });
      ok(ex.cached && ex.source === "gemini" && !ex.translation_unavailable,
         `explain ${d.design_id} ${lang}: cached=${ex.cached} source=${ex.source} unavailable=${ex.translation_unavailable}`);
      ok(!/\{\{|\d{5,}/.test(ex.text), `explain ${d.design_id} ${lang}: unresolved placeholder in text`);
    }
  }
  console.log("  explanations: 4 designs × en, fr checked");
}

console.log("Ward 04");
const { body: ward } = await timed(`${API}/ward/04`);
const { body: trend } = await timed(`${API}/ward/04/trend`);
ok(ward.headline.could === 3992 && ward.headline.did === 83, `headline ${ward.headline.could} / ${ward.headline.did} (locked 3,992 / 83)`);
console.log(`  headline ${ward.headline.could} could, ${ward.headline.did} did; trend source ${trend.source}`);
await timed(`${API}/static/permits.geojson`);
await timed(`${API}/static/wards/04.geojson`);
for (const lang of ["en", "fr"]) {
  const { body: b } = await post(`${AI}/briefing`, { ward, trend, lang });
  ok(b.cached && b.model === "gemini-3.8-flash" && !b.translation_unavailable,
     `briefing ${lang}: cached=${b.cached} model=${b.model} unavailable=${b.translation_unavailable}`);
  console.log(`  briefing ${lang}: ${b.title}`);
}
for (const lang of ["en", "fr"]) {
  const { body: html } = await timed(`${AI}/b/04?lang=${lang}`);
  ok(html.includes("window.SUPLEX"), `/b/04?lang=${lang} has no boot data`);
}
console.log(slow.length ? `Slow (over 2 s):\n  ${slow.join("\n  ")}` : "Every request under 2 s.");
console.log(failures ? `${failures} FAILURE(S)` : "ALL STAGE REQUESTS OK");
process.exit(failures ? 1 : 0);

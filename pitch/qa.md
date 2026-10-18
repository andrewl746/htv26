# Q&A prep

Status: answers drafted (S10), 2026-10-17. Facts come from [`facts.md`](facts.md) (row numbers in brackets); `[LOCKED: …]` from `ward_summary.json` at `headline-locked`. Keep answers under 20 seconds.

**Numbers filled from the `headline-locked` ward_summary.json (2026-10-17, 22:33).** Every number below equals it; the briefing and explanations were pre-generated on the same data with `gemini-3.8-flash`.

Ground rules: "may fit", never "will be built"; no candidate or party names; no ranking of wards; never "threat" or "opportunity"; it's screening, not a permit or legal advice.

---

## From MASTERSPEC section 12

**"Who will actually use this?"**
Before you build: homeowners checking, for free, whether one of the City's designs could work on their lot. Before you vote: residents, journalists and community groups who need sourced ward facts. A May 2026 recommendation to the City's planning committee asked for open houses to explain multiplexes [12]; we answer the first question for any address, at any hour.

**"Will homeowners really rebuild?"**
Most won't, and that's fine. Three quarters of the multiplex permits so far were renovations or conversions, not new buildings [6]. Whether a design could fit is still the first question, and our own numbers show far more lots where a design may fit than permits, so we say upfront that fit isn't the only barrier.

**"Isn't cost the real barrier?"**
Probably, and our gap shows it: the rules allow far more than gets built. For scale, the average declared construction value was about $1.01 million for a new-build multiplex and about $216,000 for a renovation [7]. The City already waives development charges and parkland fees on the added homes of a multiplex of up to six units [16], so construction cost is most of what's left. Cost modelling is our next step.

**"Why not LotMore?"**
LotMore leads into its own paid architecture services. Suplex is free and neutral, uses the City's own four designs, and adds the ward picture: what could fit next to what got permitted.

**"Isn't this a tool for developers?"**
No. There's no list or export of lots, and the map never shows addresses. Opening one lot shows the same screening anyone can look up for an address, with "screening only" on every result.

**"How accurate is it?"**
It's a first screen, not a permit. Lot lines in the City's data aren't survey-accurate, so anything within half a metre reads "too close to call". We list what we don't check on every result, and we hand-checked 19 real lots against the by-law.

**"Does it arm opposition to new homes?"**
It shows the same facts to everyone, in neutral words: what's allowed, and how much has been permitted. No rankings, no addresses on the map.

**"Are you ranking wards?"**
No. Each ward shows only its own numbers.

**"Doesn't the Toronto Multiplex Tracker already map permits?"**
Yes, and we credit it; we use its permit rule. Our count, permits creating 2 to 6 homes, one per project, tracks the City's own: Ward 04 is 42 in both, and 446 citywide against the City's 452 [15]. It shows what got permitted. We add what could be built with the City's free designs, side by side.

**"Why does the Sixplex Narrow fail on so many lots?"**
It's 19 m long. The by-law allows 19 m for a detached houseplex only on lots at least 36 m deep (frontage under 10 m) or 40 m deep (frontage 10 m or more); elsewhere the limit is 17 m. That's a finding, not a bug, and the checklist shows the section. *(Holds unless Andrew's T3 re-read changes decision 17.)*

**"Why is the AI allowed anywhere near this?"**
It never decides anything. It phrases numbers the engine computed, writes placeholders instead of digits, and a validator rejects any number it didn't get, including after translation. It rejected 4 drafts this weekend; we can show the log.

## Likely extra questions

**"Where does the data come from, and how current is it?"**
All City of Toronto open data: property boundaries, zoning, address points, building permits, 3D massing. Data as of permits as of October 17, 2026, lots and addresses as of October 17, 2026, zoning as of February 20, 2026; the pipeline re-runs on the City's daily refresh.

**"What about semis and row houses?"**
The free designs are detached buildings that need side yards on both sides, so attached houses are marked "not checked" with that reason. In Ward 04, 44.2% of house lots are semis or row houses. Owners there may still add homes in other ways, such as basement or garden suites, which we don't check.

**"Is the AI translation reliable?"**
Every number in a translation is checked again and must match the English, and a native speaker reviewed `[languages reviewed]`. If a translation fails the check, we show English with a notice instead.

**"Do you store the addresses people type?"**
`[Andrew: confirm what the API logs.]` The map never shows addresses, and there's no list of lots.

**"How is this different from the City's own tools?"**
The City publishes the designs and the rules; Suplex applies them to every lot and puts the result next to what was permitted, in plain language, for any ward.

**"Why only these four designs?"**
They're the City's free pre-approved plans released October 2, 2026 [3]. Custom designs and variances can do more, which is why some permit dots land on grey lots.

# Q&A prep

Status: first draft (S2). The questions are from MASTERSPEC section 12; the draft answers follow the spec's notes. Final answers are written in S10, after the batch numbers are locked. Any number said aloud must come from the locked run or a linked source.

Ground rules for every answer: "may fit", never "will be built"; no candidate names, parties or positions; no ranking of wards; never "threat" or "opportunity"; it's screening only, not a permit or legal advice.

---

### "Who will actually use this?"

Before you build: homeowners checking for free whether a City design could work on their lot. Before you vote: residents, journalists and community groups who need ward facts. The City is planning open houses to answer this question; we answer it for any address, at any hour.

### "Will homeowners really rebuild?"

Most won't, and that's fine. Whether a design could fit is still the first question every one of them asks. Our own data shows many lots where a design may fit and few permits, so we say upfront that fit isn't the only barrier.

### "Isn't cost the real barrier?"

Agreed, and the permission vs. reality gap shows it: the rules allow far more than gets built. Cost modelling is a next step.

### "Why not LotMore?"

LotMore leads into its own paid architecture services. Suplex is free and neutral, uses the City's own four designs, and adds the ward picture.

### "Isn't this a tool for developers?"

No. There's no list or export of lots, and the map never shows addresses. Opening one lot shows the same screening anyone can look up for an address, with "screening only" on every result.

### "How accurate is it?"

It's a first screen, not a permit. We say what we check and what we don't, label results within the uncertainty band "Too close to call", and hand-checked a set of real lots. *(S10: add how many lots were hand-checked, from `engine/tests/test_lots.py`.)*

### "Does it arm opposition to new homes?"

It shows the same facts to everyone, in neutral words: what's allowed, and how much has been permitted.

### "Are you ranking wards?"

No. Each ward shows only its own numbers.

### "Doesn't the Toronto Multiplex Tracker already map permits?"

Yes, and we credit it. It shows what got permitted. We add what could be built with the City's free designs, and put the two side by side.

### "Why does the Sixplex Narrow fail on so many lots?"

It's 19 m long. The by-law allows 19 m for a detached houseplex only on lots at least 36 m deep (frontage under 10 m) or 40 m deep (frontage 10 m or more); elsewhere the limit is 17 m. That's a finding, not a bug, and the checklist shows the section. *(Depends on T3, Andrew's re-read of the A011 sheet; update if that decision changes.)*

### "Why is the AI allowed anywhere near this?"

It never decides anything. It phrases numbers the engine computed, writes placeholders instead of digits, and a validator rejects any number it didn't get. We can show the rejection log. *(S10: add the rejection count from `ai/logs/rejections.jsonl`.)*

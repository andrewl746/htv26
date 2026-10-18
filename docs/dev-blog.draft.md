---
title: "An AI that isn't allowed to write numbers: building Suplex at Hack the Valley 11"
tags: hackathon, python, ai, opendata
status: draft (S13), for the MLH DEV Writing Challenge; publish after the event. Every number is from pitch/facts.md or the headline-locked ward_summary.json.
---

Since 2023, every house lot in Toronto has been allowed up to four homes. In October 2026 the City released free, pre-approved multiplex designs. What nobody could easily answer was the obvious next question: *does one fit on my lot?*

At Hack the Valley 11 our team of four built **Suplex**. You type a Toronto address, and it checks the lot against the City's four free designs, shows the result in 3D, and puts your ward's numbers side by side: lots where a design **may fit**, next to the multiplex permits **actually issued** since May 2023. In Ward 04, Parkdale–High Park, that's 3,992 house lots where a design may fit, against 83 multiplex permits.

This post is about one design decision: **the AI never writes a number.**

## Code decides, AI phrases

The fit check is plain Python: lot width, depth, building length, height, coverage and the number of homes, each rule tagged with its Zoning By-law 569-2013 section. We ran it over 421,204 house lots citywide. No model is involved.

We still wanted plain language: a sentence that tells a resident *why* a design doesn't fit, and a one-page ward briefing someone could bring to a candidates' debate. That's what we used Gemini for. The risk is obvious: a language model that writes "about 4,000 lots" when the engine said 3,992 has just made something up in a civic tool.

So the model never sees the values. It gets a list of placeholder names with their labels and units:

```
{{lot_width_actual}}    This lot's width across the building (m)
{{lot_width_required}}  Lot width the Fourplex Narrow needs (m)
{{lot_width_margin}}    Difference between the two (m)
```

and writes text like *"The lot is {{lot_width_actual}} m wide; the design needs {{lot_width_required}} m."* We fill in the numbers afterwards, and each one becomes a link to its source.

## A validator, not trust

Every draft goes through a validator before anyone sees it. It rejects:

- any digit that didn't come from the engine (years, by-law numbers and design facts are on an allow-list);
- any placeholder that doesn't exist;
- any required placeholder that's missing.

A rejected draft gets one retry with the complaint attached. If that fails too, the user sees a plain template instead. Nothing unvalidated is returned or cached. Over the weekend the validator rejected 4 drafts.

## Translation is where it got interesting

The briefing is also offered in French. Translation is a second Gemini pass over the *validated English*, and every translated string is validated again against the same placeholders.

While we were testing more languages, both Chinese translations were rejected: they wrote "May 2023" as "2023年5月", and that "5" is a digit we never supplied. The model was right and the validator was right too. We added one narrow allowance: translations (never English) may write that one month as a number.

French taught us something else. A correct translation can still be the wrong word. Our French reviewer asked for "terrain" everywhere the model wrote "lot", and pointed out that "circonscription" is a riding, not a City ward ("quartier"). So the glossary isn't a suggestion in the prompt. A translation containing a forbidden word is rejected and retried, the same way as an invented number.

## The bug that would have sunk the demo

Everything the stage demo shows is pre-generated and cached, so a flaky network can't break it. The cache key is a SHA-256 of the request's inputs. It worked perfectly in our Python tests.

Then, after our final generation pass, we took a screenshot of the briefing page for the slides and noticed the text wasn't the one we'd just generated. **JavaScript's `JSON.stringify` writes `22.0` as `22`.** Python had stored the entry under `22.0`, and the browser asked for `22`: a different hash, so every request on stage would have gone to Gemini live. The fix is one function that turns whole floats into ints before hashing, plus a test that posts the way a browser does.

We found two more like it. The key included a timestamp that changes on every live check, and a field a teammate reworded after we'd generated the cache. Neither one affects the text, so both left the key. The lesson: a cache key should hash exactly what the output depends on, nothing more, and you should test it from the client that will really call it.

## What we'd tell another team

- **Let code own the facts.** Use the model for phrasing, and make it structurally unable to state a fact.
- **Say "too close to call".** The City's lot lines aren't survey-accurate, so any rule passed or failed by less than 0.5 m reads "too close to call". That's more honest than a confident yes or no.
- **Test your cache from the real client.** Ours passed every Python test and would have missed every request on stage.

Suplex is a first screen, not a permit or legal advice. The code is at [github.com/andrewl746/htv26](https://github.com/andrewl746/htv26).

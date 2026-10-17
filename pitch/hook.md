# The 30-second hook

Status: first draft (S2). [X] and [Y] are filled from our own batch run (section 3.4) after the `headline-locked` tag at Hour 24, never from a guess or a fixture.

## The pitch (spoken, about 30 seconds)

> Since 2023, every house lot in Toronto has been allowed four homes.
>
> This month, the City gave away free blueprints. But nobody can tell you whether they fit on your street, or whether the policy is working.
>
> Type any address and watch the City's design rise on that lot in 3D.
>
> Then zoom out: in your ward, [X] lots could fit a free design, but only [Y] multiplex permits have been issued since 2023.

Close on the label, every time a result is shown: **Screening only, not a permit or legal advice.**

## Fill-ins

| Slot | What it is | Where it comes from | Say it as |
|---|---|---|---|
| [X] | lots in the demo ward where at least one free design may fit | `ward_summary.json`, demo ward, after `headline-locked` | "could fit" or "may fit"; it is an upper bound |
| [Y] | `multiplex` permits issued in the demo ward since May 2023 | `ward_summary.json` (Tiger Data or `permit_counts.json`; the file records which) | "multiplex permits since 2023, before the free designs existed" |

If the pipeline falls back to Rule B, [Y] becomes "permits for new residential buildings with 2–6 units", word for word (section 4.3).

## Tagline (pick one for the deck and the Devpost)

- *Before you build, before you vote.*
- *Four free designs, checked on every lot.*
- *What's allowed, and what got built.*

## Facts in the hook, and their sources (checked 2026-10-17, T13)

Full wording, page numbers and what was cut: [`facts.md`](facts.md).

| Claim | Source | Checked |
|---|---|---|
| Multiplexes (up to four homes) allowed on residential lots citywide since May 2023 | facts.md row 1 (Attachment 4 p3; Oct 2 news release) | yes |
| Free pre-approved designs, four types, released October 2, 2026 | facts.md row 3 (news release; plans page) | yes |
| Background, if asked: 452 permits and about 726 net new homes in the first 18 months; 75% were renovations | facts.md rows 4–6 (monitoring presentation p11–12) | yes |

## Wording rules for anyone presenting

- "May fit" or "could fit", never "will be built".
- No candidate names, parties or positions. No "best ward" or "worst ward".
- Never "threat" or "opportunity".
- Fixture numbers (the "100 Fixture St" lot and its counts) never appear in the pitch.

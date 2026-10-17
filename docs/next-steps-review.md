# S14: tone and fact review of `contracts/copy/next_steps.json`

Reviewed by Simone, 2026-10-17, on branch `yuvi-next-steps` (PR #18), against `pipeline/reports/07-next-steps-sources.md`. Yuvi owns the file and applies the changes.

## Verdict

Passes, with six wording changes and one sourcing gap. Every step is sourced; none names a business, a person or a candidate; nothing says "will be built"; the footer ("Screening only, not a permit or legal advice … confirm with the City before you rely on them") and the `why` lines read neutrally. The fees step matches By-law 845-2025 exactly, including the parkland "seven with a garden or laneway suite" detail, and `pitch/facts.md` row 16 now carries that detail too.

The changes below are about one thing: a few sentences tell the reader what they can or must do, which reads like legal advice. Saying what the City's rule or page says keeps the same facts and stays a screening.

## Wording changes (for Yuvi)

| Step | Now | Suggested | Why |
|---|---|---|---|
| `ravine.text` | "Without a ravine permit you cannot harm or remove any tree there regardless of size, change …" | "The City requires a ravine permit before anyone harms or removes a tree there of any size, changes the natural land topography (digging, or adding soil on slopes), places fill, or builds or replaces structures or retaining walls." | "You cannot" is an instruction; this states the City's rule, same facts |
| `site_exception.text` and `text_without_number` | "A Chapter 900 exception can set limits that still apply …" | "A Chapter 900 exception may set limits that still apply …" | the source says "may still apply" |
| `heritage.text` | "A listed property is not protected, but its owner must give Council at least 60 days' notice before demolishing. Email Heritage Planning before you design." | "A listed property has no protection under the Ontario Heritage Act, except that its owner must give City Council at least 60 days' notice before demolishing. Heritage Planning can advise before you design." | "not protected" overstates without the Act; the last sentence becomes information, not an order |
| `trca.text` | "Talk to a TRCA planner before you apply." | "TRCA encourages talking to one of its planners before you apply." | matches the quote ("encourages clients to discuss") and isn't an order |
| `fees.text` | "A multiplex of up to six units pays no development charges …" | "Under By-law 845-2025 (July 24, 2025), a multiplex of up to six units pays no development charges …"; end with "Some City web pages still say four units; the by-law is the current rule." | attributes the rule to its source up front, so it reads as information about the by-law |
| `demolition.text` | "Replacing the existing house means a demolition permit as well." | "Replacing the existing house also needs a demolition permit." | same claim, plainer; optional |

Everything else stands as written: `survey`, `zoning_check`, `trees`, `designer`, `permit`, `attached_options`, `custom_or_variance`, `ask_zoning`, the groups, the footer and all `why` templates.

## Sourcing gap (no wording change)

Three claims are confirmed in report 07 but their quotes are not in the step's own `sources` list in the JSON, so the file isn't self-contained:

- `ravine`: add the page's "Harming or removing any trees, regardless of size" (report line 82).
- `permit`: add the plans page's Required Forms rows for the Infill Public Notice Declaration Form and the Municipal Road Damage Form (report lines 177 and 178).
- `attached_options`: add By-law 474-2023 10.5.20.40(2) and (3) with condition (A), "the original building was constructed prior to May 15, 2023 and the additional dwelling units are contained entirely within the lawfully existing building" (report lines 212 and 213); the current source quote covers semis only and not the date condition.

## Done on my side

- `pitch/facts.md` row 16: the parkland "up to seven with a garden or laneway suite" detail.
- `pitch/demo-script.md`: one line for next steps in the address-check beat (step 7, "if time").

# Demo ward and backup addresses (S9)

Status: **to fill after the citywide batch run (A10)**, with Andrew, from real results. Never invent an address or a result.

## Demo ward

Ward 04, Parkdale–High Park (decision 11), unless the batch results make another sixplex ward a clearer story. Decided: `[ ]` on `[date/time]` by `[Simone, Andrew]`.

## Backup addresses

How to pick (MASTERSPEC 8.4):

- **Address 1 (fits):** a lot where Fourplex Narrow and Fourplex Wide both `fit`, with no flags, on a street with neighbours in the massing data and a few street trees.
- **Address 2 (borderline or no fit):** a lot that is `borderline` on `lot_width` (a 25-foot lot) or a clear `no_fit`.
- Prefer lots with **no multiplex permit dot within 50 m**, so the demo never implies anything about an owner's plans.
- **Never a teammate's home** unless they volunteer.

| | Address (as typed) | `address_id` | Expected results (FN / FW / SN / SW) | Deciding rule | Checked live on |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |

After choosing: Andrew runs `python -m api.cache_demo`; Simone runs
`python -m ai.pregenerate --ward 04 --langs all --address-id <id1> --address-id <id2>`
and then, after the Hour-24 lock, the same command with `--model gemini-3.8-flash --refresh` (about 16 requests of its 20 a day).

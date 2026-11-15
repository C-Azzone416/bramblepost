# Spring letter threads (final record for #8)

This is the record for the spring letters in `src/letters/spring.ts`. It supersedes the draft in PR #32 (`docs/spring-letter-threads-draft.md`). The letters are tested in `tests/letters-spring.test.ts`.

## Decisions (assumptions Caroline can overturn)

1. **Kept:** Marigold, the Hollowmere Spring Fair, the Hollowmere Trestle & Tablecloth Co. and the Hollowmere Mole Guild.
2. **The Mole Bros are Bert and Basil.**
3. **Door-reply swaps (#9) are on hold.** Each slot has ONE default letter. Where the draft had a swap pair, the default is the version that needs no specific reply. Follow-up letters use a plain `read` requirement on the default letter.
4. **Bea's pies are test bakes** for the Hollowmere Spring Fair (not a romance).
5. **Placement uses the real routes 1-15** (`src/levels/spring.ts`, `src/village/data.ts`). Routes and parcels are unchanged. Route 15 carries no letter, so the ending has room.
6. **A letter's recipient is the house its parcel is delivered to.** No letter-type parcel on routes 1-15 goes to the Teapot Cottage (Clementine), and only two go to the Mushroom House (Bea). So Clementine's thread is told through letters she sends and letters about her (to Barnaby and the Moles), and nobody writes to her.
7. **Three swap slots for #9** (the user's call, relayed by the PM): `supper-1`, `fair-2` and `supper-5`. The draft's `clementine.sisterNote` (`carrots-1`) and `moles.puddle` (`tunnel-4`) swaps are dropped: those two are single versions, written so they are easy to turn into swaps later.
8. **`supper-5` (the Supper invitation) is addressed to the Moles**, the neighbour route 14's letter slot delivers to, and invites them "and Clementine too". That is a PM call.
9. **The draft's `E2` (the Fair rules) is folded into `fair-1`**, and the draft's `C4` (Marigold's confession) is not written. Bea's two letter slots went to `fair-1` and `supper-1`, and route 14's only letter slot went to the invitation. The confession can live in the Supper ending (#58).

## Placement table

Slot is the index into the route's `parcels`. Every row is a `letter` or `signed` parcel, delivered to the recipient's house. Route 15 (`lastround`) has a signed parcel but carries no letter.

| Route | Route id | Slot | Parcel | Letter | Thread | Sender → recipient | Requires |
|---|---|---|---|---|---|---|---|
| 1 | primrose | 0 | letter | `fair-1` | fair | Hollowmere Spring Fair → Bea | none |
| 3 | millpond | 0 | letter | `tunnel-1` | tunnel | Mill Pond Committee → Moles | none |
| 4 | footbridge | 0 | letter | `tunnel-2` | tunnel | Hollowmere Mole Guild → Moles | `tunnel-1` |
| 5 | hollow | 0 | letter | `carrots-1` | carrots | Marigold → Barnaby | none |
| 5 | hollow | 1 | signed | `tunnel-3` | tunnel | Mill Pond Committee → Moles | `tunnel-2` |
| 6 | willow | 0 | letter | `supper-1` **(swap slot)** | supper | Barnaby → Bea | none |
| 9 | latch | 0 | letter | `carrots-2` | carrots | Clementine → Moles | `carrots-1` |
| 9 | latch | 1 | signed | `supper-2` | supper | Trestle & Tablecloth Co. → Barnaby | `supper-1` |
| 10 | hedgerow | 1 | signed | `fair-2` **(swap slot)** | fair | Bea → Moles | `fair-1` |
| 11 | pietin | 0 | letter | `supper-3` | supper | Trestle & Tablecloth Co. → Barnaby | `supper-2` |
| 12 | sealed | 0 | letter | `fair-3` | fair | Hollowmere Spring Fair → Barnaby | `fair-2` and `carrots-1` |
| 12 | sealed | 1 | signed | `supper-4` | supper | Barnaby → Moles | `supper-3` |
| 13 | kitten | 0 | letter | `tunnel-4` | tunnel | Bert and Basil → Barnaby | `tunnel-3`, `supper-4` and `carrots-2` |
| 13 | kitten | 1 | signed | `carrots-3` | carrots | Clementine → Moles | `carrots-2` |
| 14 | dovecote | 1 | signed | `supper-5` **(swap slot)** | supper | Barnaby → Moles | `tunnel-4` |

Routes 2, 7, 8 and 15 carry no letter (routes 2, 7 and 8 have no letter-type parcel, route 15 is the ending). Compared with the draft, the three swap slots moved: the draft's route 7 letter (`B2`) is now on route 6, because route 7 has no letter parcel and route 6 is the nearest route with a letter parcel to Bea.

## The threads

Each secret only makes sense once two or more of its letters are read.

**fair (Bea).** Bea has entered the Hollowmere Spring Fair under "A Mouse", and the rules say pies must be tasted by an honest neighbour. She's too shy to ask, so the test pies arrive on Barnaby's step, unsigned. `fair-1` the entry is accepted (and the rules), `fair-2` she asks the Moles to cool a test pie, `fair-3` the Fair names Marigold as judge and Barnaby's table as the venue.

**tunnel (the Moles).** The "small unexplained puddle" is the tip of a tunnel network with a hatch under every house. `tunnel-1` the puddle, `tunnel-2` the Guild's map (fourteen branches), `tunnel-3` the conditional permit that Barnaby signed without reading, `tunnel-4` the hatches will hold Barnaby's table steady (and a postscript about Clementine's carrots).

**supper (Barnaby).** Barnaby is planning a surprise Spring Supper on one very long table. He can't cook, so every letter looks like an odd errand. `supper-1` thanks "the Baker" and asks about pies for twelve, `supper-2` and `supper-3` the table company (twelve chairs, a very long cloth, a lawn it won't fit), `supper-4` asks the Moles to steady the table, `supper-5` the invitation.

**carrots (Clementine).** Clementine has told her sister Marigold that her carrots are "coming up beautifully" (they are shy). `carrots-1` Marigold writes to Barnaby that she'll visit and admire them, `carrots-2` Clementine asks the Moles for a quiet word about the soil, `carrots-3` the plank works and one carrot has come up. The ending (#58) can have Marigold confess she buys her own carrots.

Cross-links that make the threads one story: `fair-3` needs `carrots-1` (Marigold is the judge), `tunnel-4` needs `supper-4` and `carrots-2`, and `supper-5` needs `tunnel-4`.

## Where #9 gives alternatives

Same slot, same house, so par and parcels never change.

| Slot | Letter | Door flag | Default (this PR) | Alternative(s) in #9 |
|---|---|---|---|---|
| willow #0 (route 6) | `supper-1` | `barnaby.pieBaker` | "To the Baker, with thanks" (needs no specific reply) | `told`: addressed to Bea by name |
| hedgerow #1 (route 10) | `fair-2` | `bea.pudding` | Thank-you and a request, works either way | `gentleman`: thank-you with a paw-print; `letter`: apology for the eaten post |
| dovecote #1 (route 14) | `supper-5` | `clementine.sundayNews` | Mystery invitation | `tell`: the whole surprise spilled, because Clementine already knows |

Not swaps for now, but easy to make: `carrots-1` (`clementine.sisterNote`, read / later: Marigold's delighted or worried note) and `tunnel-4` (`moles.puddle`, help / quiet). The follow-up letters of a swap slot must still use a plain `read` requirement on the slot's default letter id (or an `any` of the alternatives once #9 lands).

## Out of scope here

The Supper ending (#58) and any new UI. The ending may bring the four threads together at Barnaby's long table: the Moles' hatches under the legs, Bea's pie entered with her name and judged by Marigold, and Marigold's carrot confession.

# Spring letter threads (final record for #8)

This is the record for the spring letters in `src/letters/spring.ts`. It supersedes the draft in PR #32 (`docs/spring-letter-threads-draft.md`). The letters are tested in `tests/letters-spring.test.ts`.

## Sign-off and implementation notes

**Signed off by Caroline (2026-11-15) with these edits:**

1. Kept: Marigold, the Hollowmere Spring Fair, the Hollowmere Trestle & Tablecloth Co. and the Hollowmere Mole Guild.
2. The Mole Bros are **Bert and Basil**.
3. Three slots swap on a door reply (#9, see "Door-reply swaps"); each swap slot keeps its default for no reply. The draft's other two swaps (`clementine.sisterNote`, `moles.puddle`) are single versions.
4. Bea's pies are test bakes for the Hollowmere Fair (not a romance).
5. Route placement is confirmed against the real routes 1-15 (`src/levels/spring.ts`, `src/village/data.ts`). Routes and parcels are unchanged, and route 15 carries no letter so the ending has room.

**Implementation notes (needed to fit the real parcels):**

6. A letter's recipient is the house its parcel is delivered to. No letter-type parcel on routes 1-15 goes to the Teapot Cottage (Clementine), and only two go to the Mushroom House (Bea). So Clementine's thread is told through letters she sends and letters about her (to Barnaby and the Moles), and nobody writes to her.
7. PM implementation note: `supper-5` (the draft's B4, the Supper invitation) cannot be addressed to Clementine. It rides route 14's only letter slot, so it is addressed to the neighbour that slot delivers to (the Moles) and invites them "and Clementine too".
8. The draft's route 7 swap letter (B2) is `supper-1` on route 6: route 7 has no letter parcel, and route 6 is the nearest route with a letter parcel to Bea.
9. The draft's `E2` (the Fair rules) is folded into `fair-1`, and the draft's `C4` (Marigold's confession) is not written as a letter. Bea's two letter slots went to `fair-1` and `supper-1`, and route 14's only letter slot went to the invitation. The confession now lives in the Supper ending (#58, see below).

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
| 14 | dovecote | 1 | signed | `supper-5` **(swap slot)** | supper | Barnaby → Moles | `tunnel-4` and `supper-4` |

Routes 2, 7, 8 and 15 carry no letter (routes 2, 7 and 8 have no letter-type parcel, route 15 is the ending).

## The threads

Each secret only makes sense once two or more of its letters are read.

**fair (Bea).** Bea has entered the Hollowmere Spring Fair under "A Mouse", and the rules say pies must be tasted by an honest neighbour. She's too shy to ask, so the test pies arrive on Barnaby's step, unsigned. `fair-1` the entry is accepted (and the rules), `fair-2` she asks the Moles to cool a test pie, `fair-3` the Fair names Marigold as judge and Barnaby's table as the venue.

**tunnel (the Moles).** The "small unexplained puddle" is the tip of a tunnel network with a hatch under every house. `tunnel-1` the puddle, `tunnel-2` the Guild's map (fourteen branches), `tunnel-3` the conditional permit that Barnaby signed without reading, `tunnel-4` the hatches will hold Barnaby's table steady (and a postscript about Clementine's carrots).

**supper (Barnaby).** Barnaby is planning a surprise Spring Supper on one very long table. He can't cook, so every letter looks like an odd errand. `supper-1` thanks "the Baker" and asks about pies for twelve, `supper-2` and `supper-3` the table company (twelve chairs, a very long cloth, a lawn it won't fit), `supper-4` asks the Moles to steady the table, `supper-5` the invitation. It is deliberately a mystery (the last Sunday of spring, "come hungry", bring your hatches and Clementine) that only clicks for a reader of the earlier supper letters. It never says "Spring Supper" or "long table"; the full reveal belongs to the Supper ending (#58). It needs `supper-4` as well as `tunnel-4`, so it is always the end of its own thread.

**carrots (Clementine).** Clementine has told her sister Marigold that her carrots are "coming up beautifully" (they are shy). `carrots-1` Marigold writes to Barnaby that she'll visit and admire them, `carrots-2` Clementine asks the Moles for a quiet word about the soil, `carrots-3` the plank works and one carrot has come up. The ending (#58) can have Marigold confess she buys her own carrots.

Cross-links that make the threads one story: `fair-3` needs `carrots-1` (Marigold is the judge), `tunnel-4` needs `supper-4` and `carrots-2`, and `supper-5` needs `tunnel-4` and `supper-4`.

## Door-reply swaps (#9)

A reply flag swaps which letter a later route carries, in the **same parcel slot**, so par, parcels and houses never change. The data is `SPRING_SLOTS` in `src/letters/spring.ts`; `letterForParcel(route, slot, flags)` (registry.ts) resolves it through `letterForSlot`, and the satchel envelope, the post-route queue and the album all use that one lookup. An alternate carries the same placement as its default (the album counts one slot per placement). No reply, or an unknown or inherited one (`toString`), gives the default.

| Slot | Flag | Default (reply) | Alternate (reply) |
|---|---|---|---|
| willow #0 (route 6) | `barnaby.pieBaker` | `supper-1` "To the Baker, with thanks" (`secret`, or none) | `supper-1b` addressed to Miss Thimblewick by name (`told`) |
| hedgerow #1 (route 10) | `bea.pudding` | `fair-2` thank-you for minding Pudding and a request (`gentleman`, or none) | `fair-2b` apology for the eaten letter, a scone enclosed, then the request (`letter`) |
| dovecote #1 (route 14) | `clementine.sundayNews` | `supper-5` the mystery invitation (`keep`, or none) | `supper-5b` the lane already knows and Clementine is in on it, still no "supper" (`tell`) |

Letters that follow a swap slot accept either version with an `any` requirement: `supper-2` needs `supper-1` or `supper-1b`, and `fair-3` needs `fair-2` or `fair-2b`. `supper-5`/`supper-5b` end their thread and nothing follows them. Every combination of the three replies (and unset) is played through in `tests/letters-swaps.test.ts`.

Not swaps for now, but easy to make: `carrots-1` (`clementine.sisterNote`, read / later: Marigold's delighted or worried note) and `tunnel-4` (`moles.puddle`, help / quiet). When one becomes a swap, add its alternate with the same placement, add a `SPRING_SLOTS` entry, and let its followers require an `any` of both versions.

## Out of scope here

Any new UI. (The Supper ending, #58, is now written: see "In the ending".) The ending brings the four threads together at Barnaby's long table: the Moles' hatches under the legs, Bea's pie entered with her name and judged by Marigold, and Marigold's carrot confession.

## In the ending (#58)

The closing scene is Barnaby's Spring Supper (`src/door/ending.ts`, rules in docs/design.md "Ending"). **C4, Marigold's confession, is now in it**: over the soup she admits she buys her own carrots at market. It plays for every player, since it needs no earlier letter to be funny. The other threads land with one variant each, by whether their letters were read:

| Thread | Read line (any of) | No-letters line |
|---|---|---|
| tunnel | `tunnel-3`, `tunnel-4`: a hatch under each leg, signed for | the table is steady and two moles are very quiet |
| carrots | `carrots-1`..`3`: Marigold admires the one flagged carrot | Marigold visits, the lane holds its breath |
| supper | `supper-2`..`supper-5b`: "I wrote many letters" | "I asked the whole lane" |
| fair | `fair-1`..`fair-3`: Marigold judges the Fair pies | Marigold's verdict on Bea's test bake |

The swap flags each pick a line (`barnaby.pieBaker` told / Baker, `bea.pudding` letter / postmaster, `clementine.sundayNews` tell / no idea), with the no-reply default matching the swap slot's default.

# Spring letter threads (final record for #8)

This is the record for the spring letters in `src/letters/spring.ts`. It supersedes the draft in PR #32 (`docs/spring-letter-threads-draft.md`). The letters are tested in `tests/letters-spring.test.ts`.

## Implementation after #121

Spring uses the ten routes in `src/levels/spring.ts`, in the same order as `src/village/data.ts`.
Kept grids, parcels and pars are unchanged. The final route (`lastround`) carries no letter.
The standard placeholder pack folds `tunnel-3` into `tunnel-2`, `supper-3` and `supper-4` into
`supper-2`, and `carrots-2` into `carrots-1`. Requirements and ending checks use those retained ids.
All three door-reply swaps remain. The early scene formerly keyed to `clover` is keyed to `millpond`.

## Placement table

Slot is the index into the route's `parcels`. Every row rides a `letter` or `signed` parcel at its recipient's house.
Alternates share their default's placement. `brook` and `lastround` carry no letter.

| Route | Route id | Slot | Parcel | Letter | Thread | Recipient id | Requires |
|---|---|---|---|---|---|---|---|
| 1 | primrose | 0 | letter | `fair-1` | fair | bea | none |
| 2 | millpond | 0 | letter | `tunnel-1` | tunnel | moles | none |
| 3 | footbridge | 0 | letter | `tunnel-2` | tunnel | moles | `tunnel-1` |
| 4 | hollow | 0 | letter | `carrots-1` | carrots | barnaby | none |
| 4 | hollow | 1 | signed | `fair-2` **(swap slot)** | fair | moles | `fair-1` |
| 5 | willow | 0 | letter | `supper-1` **(swap slot)** | supper | bea | none |
| 7 | latch | 0 | letter | `carrots-3` | carrots | moles | `carrots-1` |
| 7 | latch | 1 | signed | `supper-2` | supper | barnaby | `supper-1` or `supper-1b` |
| 8 | pietin | 0 | letter | `tunnel-4` | tunnel | barnaby | `tunnel-2`, `supper-2` and `carrots-1` |
| 9 | sealed | 0 | letter | `fair-3` | fair | barnaby | `fair-2` or `fair-2b`, and `carrots-1` |
| 9 | sealed | 1 | signed | `supper-5` **(swap slot)** | supper | moles | `tunnel-4` and `supper-2` |

## The threads

| Thread id | Letter ids in reading order |
|---|---|
| fair | `fair-1`, `fair-2` / `fair-2b`, `fair-3` |
| tunnel | `tunnel-1`, `tunnel-2`, `tunnel-4` |
| supper | `supper-1` / `supper-1b`, `supper-2`, `supper-5` / `supper-5b` |
| carrots | `carrots-1`, `carrots-3` |

Cross-thread requirements appear in the placement table. The queue uses letters read before the route,
so no letter depends on another letter delivered on the same route.

## Door-reply swaps (#9)

A reply flag swaps which letter a later route carries, in the **same parcel slot**, so par, parcels and houses never change. The data is `SPRING_SLOTS` in `src/letters/spring.ts`; `letterForParcel(route, slot, flags)` (registry.ts) resolves it through `letterForSlot`, and the satchel envelope and the post-route queue use that one lookup. The album does not call it: it groups every version of a letter by placement (`route#slot`) and counts one slot per placement, since an alternate carries the same placement as its default. No reply, or an unknown or inherited one (`toString`), gives the default.

| Slot | Flag | Default (reply) | Alternate (reply) |
|---|---|---|---|
| willow #0 (route 5) | `barnaby.pieBaker` | `supper-1` "To the Baker, with thanks" (`secret`, or none) | `supper-1b` addressed to Miss Thimblewick by name (`told`) |
| hollow #1 (route 4) | `bea.pudding` | `fair-2` thank-you for minding Pudding and a request (`gentleman`, or none) | `fair-2b` apology for the eaten letter, a scone enclosed, then the request (`letter`) |
| sealed #1 (route 9) | `clementine.sundayNews` | `supper-5` the mystery invitation (`keep`, or none) | `supper-5b` the lane already knows and Clementine is in on it, still no "supper" (`tell`) |

Letters that follow a swap slot accept either version with an `any` requirement: `supper-2` needs `supper-1` or `supper-1b`, and `fair-3` needs `fair-2` or `fair-2b`. `supper-5`/`supper-5b` end their thread and nothing follows them. Every combination of the three replies (and unset) is played through in `tests/letters-swaps.test.ts`.

Not swaps for now, but easy to make: `carrots-1` (`clementine.sisterNote`, read / later: Marigold's delighted or worried note). When one becomes a swap, add its alternate with the same placement, add a `SPRING_SLOTS` entry, and let its followers require an `any` of both versions.

## Out of scope here

Any new UI. (The Supper ending, #58, is now written: see "In the ending".) The ending brings the four threads together at Barnaby's long table: the Moles' hatches under the legs, Bea's pie entered with her name and judged by Marigold, and Marigold's carrot confession.

## In the ending (#58)

The closing scene is Barnaby's Spring Supper (`src/door/ending.ts`, rules in docs/design.md "Ending"). **C4, Marigold's confession, is now in it**: over the soup she admits she buys her own carrots at market. It plays for every player, since it needs no earlier letter to be funny. The other threads land with one variant each, by whether their letters were read:

| Thread | Read line (any of) | No-letters line |
|---|---|---|
| tunnel | `tunnel-2`, `tunnel-4`: a hatch under each leg, signed for | the table is steady and two moles are very quiet |
| carrots | `carrots-1`, `carrots-3`: Marigold admires the one flagged carrot | Marigold visits, the lane holds its breath |
| supper | `supper-2`, `supper-5`, `supper-5b`: "I wrote many letters" | "I asked the whole lane" |
| fair | `fair-1`..`fair-3`: Marigold judges the Fair pies | Marigold's verdict on Bea's test bake |

The swap flags each pick a line (`barnaby.pieBaker` told / Baker, `bea.pudding` letter / postmaster, `clementine.sundayNews` tell / no idea), with the no-reply default matching the swap slot's default.

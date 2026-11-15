# Spring letter threads: draft for Caroline's review

Step 1 of #8. This is a **draft of the secrets and thread outlines only**. No letters are written and no code changes until Caroline signs off.

Everything here is a suggestion: names I've invented are marked **(new)**, route numbers are placements for routes 1-15, and route 6-15 parcels don't exist yet.

## How to read this

- Every letter goes to a house in Thistledown, so senders from elsewhere (Hollowmere) write *in*, and nobody writes out.
- **Envelope** is what Pip can see (kept under 140 characters). **Gist** is what the neighbour reads out, in one line.
- **Requires** is an earlier letter and/or a door-reply flag (#6). Letters marked **(swap)** have two versions, see "Door replies that swap an envelope" below.
- Five letters (E1, M1, M2, M3, B1) use letter slots that already exist in routes 1-5: route 1 carries a letter to Bea, route 3 to the Moles, route 4 to the Moles, route 5 a letter to Barnaby and a signed letter to the Moles. Where a route has no letter slot yet, a new slot is assumed.
- Letter IDs: **C**lementine, **B**arnaby, **E** for Bea (Bea's thread is E so it doesn't clash with Barnaby), **M**oles.

## Clementine Fernsby (rabbit)

**Secret.** Clementine has been telling her sister Marigold that her carrots are coming up beautifully (they're shy, and a bit tragic). Now Marigold is coming to visit at the end of spring to admire them, and Clementine is quietly arranging help. Alone, each letter is just a note about carrots. Together it's a very small, very sweet panic.

| # | Route | Sender → recipient | Envelope | Gist | Requires |
|---|---|---|---|---|---|
| C1 (swap) | 6 | Marigold (new) → Clementine | *read:* "Marigold's neat hand, thick envelope. 'Re: your lovely news' underlined twice." / *later:* "Marigold's neat hand, thin envelope. 'Re: my last note' with a worried question mark." | *read:* delighted the carrots are "coming up beautifully", she'll visit at spring's end to see them. *later:* no reply came, so she'll visit at spring's end to "rescue" them. | `clementine.sisterNote` is `read` or `later` (either) |
| C2 | 8 | Clementine → the Moles | "Clementine's best stationery, hastily blotted. The word 'discretion' appears three times on the front." | Asks the Moles for a quiet word about the soil under her carrot bed, after dark. | C1 |
| C3 | 11 | the Moles → Clementine | "From the Moles, in pencil and soil. 'Re: your carrots (they're not tragic, they're hanging).'" | The carrots were dangling over the tunnel all along. A plank has been fitted; they'll surface by Sunday. | C2 |
| C4 | 13 | Marigold → Clementine | "Marigold in a rush. A hamper-shaped bulge, and a tiny circled carrot drawn in the corner." | Arriving for the supper. Confession: she buys her own carrots at Hollowmere market, and "tragic" was her being cross. | C3 |

**Builds on the door scenes.**
- `clementine.sisterNote` (`read` / `later`), route 1: the note tucked in the seeds. C1 is Marigold's answer, and the two versions are the two replies' consequences.
- Route 5 already has Clementine say `read`: "I wrote back to my sister. Told her my carrots are coming up beautifully. They are not." That line *is* the secret, and C1's read version confirms it. For `later`: "I planted them shallower, out of principle."
- `clementine.sundayNews` (`tell` / `keep`), route 5: used by B4, below.

## Old Barnaby (squirrel)

**Secret.** Barnaby is planning a surprise Spring Supper for the whole lane, on one very long table. He can't cook, so every letter he sends or gets looks like an odd errand (twelve chairs, a table that won't fit, a question about pies). It's only once two of them are read that the plan shows.

| # | Route | Sender → recipient | Envelope | Gist | Requires |
|---|---|---|---|---|---|
| B1 | 5 | Hollowmere Trestle & Tablecloth Co. (new) → Barnaby | "From the Hollowmere Trestle & Tablecloth Co. Stamped URGENT in cheerful red, with a tiny drawing of a chair." | Confirms twelve chairs and one tablecloth "of the usual length (very long)". | none |
| B2 (swap) | 7 | Barnaby → Bea | *told:* "Barnaby's best handwriting, addressed to Bea by name. Smells faintly of waistcoat and nerves." / *secret:* "Addressed only 'To the Baker, with thanks'. Pip tries very hard to look as if he doesn't know." | Thank you for the pies. Hypothetically, how many could one mouse bake for twelve? | B1 and `barnaby.pieBaker` is `told` or `secret` (either) |
| B3 | 9 | Trestle & Tablecloth Co. → Barnaby | "Hollowmere Trestle & Tablecloth Co., second notice. One polite exclamation mark, then two more." | Your table is rather long. It won't fit on your lawn, only along the lane, and the cobbles are lumpy. | B1 |
| B4 (swap) | 14 | Barnaby → Clementine | *tell:* "Cream card with gold-crayon edging. Barnaby's initials, and a small doodle of a pie." / *keep:* "Cream card, sealed twice. 'Tell no one' is written on the back, then crossed out, then written again." | Invitation to the Spring Supper, and she may bring her sister. *tell:* he spills the whole surprise, since Pip told her the news. *keep:* it's a mystery invite, since she's good at secrets. | B3 and M4 |

**Builds on the door scenes.**
- `barnaby.pieBaker` (`told` / `secret`), route 2: B2 goes to Bea either way. With `told`, Barnaby knows who baked (his good waistcoat, the dish on the step); with `secret`, he writes to "the Baker" and Pip carries it to Bea without a word.
- Route 2's "That's the third one this spring": the pies are Bea's thread (E2, E3), and B2 is where the two threads meet.
- Route 3's "don't tell Barnaby, he'll want a tour" is paid off in M3 (he signs the tunnel permit without reading it).
- `clementine.sundayNews`: see B4.

## Bea Thimblewick (mouse)

**Secret.** The pies aren't a romance. Bea has entered the Hollowmere Spring Fair (under a smudged "A Mouse" because she's too shy for her own name), and the rules say pies must be tasted by an honest neighbour first. She's too shy to ask, so the test pies arrive on Barnaby's step, unsigned, and the empty dishes are how she gets her feedback.

| # | Route | Sender → recipient | Envelope | Gist | Requires |
|---|---|---|---|---|---|
| E1 | 1 | Hollowmere Spring Fair (new) → Bea | "Hollowmere Spring Fair, stamped ACCEPTED. The entrant's name has been smudged by a very nervous thumb." | Pie entry accepted for "A Mouse (name withheld at her request)". Judge to be named. | none |
| E2 | 7 | Spring Fair → Bea | "Fair rules, second page. A pencilled note: 'Test on an honest neighbour, not your mother.'" | Entries must be tasted at home by someone who won't be kind. Bea looks across the lane, thoughtfully. | E1 |
| E3 (swap) | 10 | Bea → the Moles | *gentleman:* "From Bea on pink paper, smelling of scones. A tiny paw-print in the corner (Pudding signed too)." / *letter:* "From Bea on pink paper, third draft. The top line reads 'Sorry in advance.'" | Thank you for minding Pudding (or: apologies if he ate your post, here's a pie). Either way, may she cool a pie in their very cool burrow? | E2 and `bea.pudding` is `gentleman` or `letter` (either) |
| E4 | 14 | Spring Fair → Bea | "Hollowmere Spring Fair again. A ribbon-and-wax envelope with a faint smell of lavender." | Judge confirmed: Mrs Marigold Fernsby. Hollowmere's hall roof is being mended, so judging will be at the Thistledown supper. | E3 |

**Builds on the door scenes.**
- `bea.pudding` (`gentleman` / `letter`), route 4: Pudding stayed with the Moles all week, so E3 goes to them either way. `letter` ("He ate a letter"): Bea says she'll "write to everyone and apologise, just in case", and E3 is that letter.
- Route 2's mystery pies (and Barnaby's `told` / `secret` reply) are the other half of her secret.
- Route 5's gossip ("Barnaby went by in his good waistcoat, carrying a pie dish. Toward the Mushroom House!") fits E2 and B2.

## The Mole Bros. (moles)

**Secret.** The Moles' "small unexplained puddle" is the tip of a tunnel network. Starting as a shortcut to Bea's scones, it now reaches every house in Thistledown, with a hatch under each. They're very embarrassed and very proud of it. The puddle letter alone is a puzzle; the Guild's map makes it clear.

| # | Route | Sender → recipient | Envelope | Gist | Requires |
|---|---|---|---|---|---|
| M1 | 3 | Mill Pond committee → the Moles | "Mill Pond committee, stamped 'Concerning a Small Puddle'. Slightly damp at one corner." | Already in the route 3 scene: an unexplained puddle has appeared underneath the pond. | none |
| M2 | 4 | Hollowmere Mole Guild (new) → the Moles | "Hollowmere Mole Guild, very official. A folded map and a muddy thumbprint 'for scale'." | Their tunnel survey arrived: fourteen branches, one for every house in the village. Did they perhaps mean "burrow"? | M1 |
| M3 | 5 (signed) | Mill Pond committee → the Moles | "Mill Pond committee, official. A wax seal and a blank line marked 'Witness', waiting for a squirrel." | A conditional permit for "small works", needing a neighbour's signature. Barnaby signs without reading past "Dear Sir". | M2 |
| M4 (swap) | 12 | the Moles → Barnaby | *help:* "Paw-printed note smelling of biscuits. 'Strictly confidential.' Bert has signed it twice." / *quiet:* "A note in very small writing. 'Postie only! Eyes down, Barnaby.'" | Their hatches can hold the long table's legs steady on the lumpy cobbles. *help:* thanks for the Thursday bucket, you're now a Friend of the Tunnel. *quiet:* the same offer, in code ("the biscuit tin"). | B3 and `moles.puddle` is `help` or `quiet` (either) |

**Builds on the door scenes.**
- `moles.puddle` (`help` / `quiet`), route 3: M4's two versions (help: "Bring a bucket on Thursday"; quiet: "A postie who keeps a secret!").
- "We have no idea how that happened. None at all." gets a funny answer in M2's map.
- "Don't tell Barnaby, he'll want a tour": M3 and M4 have him learning anyway, by paperwork.
- Pudding stays at the Moles' all week (route 4), so E3 gets a reason to go there.

## Door replies that swap an envelope (#9)

A swap picks which letter a later route carries, in the same slot, for the same house, so par and solutions never change. Both versions continue the thread, so nothing dead-ends. The follow-up letter must require "either version" (suggest: an "any of" requirement in #6).

1. **`clementine.sisterNote`** (route 1) → **C1** on route 6, to Clementine: `read` brings Marigold's delighted version, `later` brings her worried one. Both announce the visit.
2. **`barnaby.pieBaker`** (route 2) → **B2** on route 7, to Bea: `told` is addressed by name, `secret` to "the Baker".
3. **`bea.pudding`** (route 4) → **E3** on route 10, to the Moles: `gentleman` brings the thank-you, `letter` the apology.
4. **`moles.puddle`** (route 3) → **M4** on route 12, to Barnaby: `help` is warm and chatty, `quiet` is in code.
5. **`clementine.sundayNews`** (route 5) → **B4** on route 14, to Clementine: `tell` spills the supper, `keep` is a mystery invitation.

That's five swaps, which is more than #9's minimum of two. Cut to the best two or three if five feels like too much to author.

## How the four threads could come together (a suggestion for #23; #26 is Caroline's call)

The ending is the **Spring Supper**, held on Barnaby's very long table down the lane (route 15's door scene, or the closing scene after it):

- **Barnaby's** table is the party. Its legs are held steady by the **Moles'** hatches, and the tunnel is revealed to the whole lane (gently, with biscuits).
- **Bea's** pie is finally entered, with her name this time. The judge is Marigold, who is **Clementine's** sister.
- **Marigold** arrives with a hamper and admits the carrots are shop-bought, so **Clementine** is off the hook, and the Moles' plank has the real ones coming up.
- Who's at the table, and who owns up first, can vary by the five reply flags.

Route 15 carries no letter on purpose, so the ending doesn't compete with an envelope.

## Questions for Caroline

1. **New characters and places:** Marigold, the Hollowmere Spring Fair, the Hollowmere Trestle & Tablecloth Co. and the Hollowmere Mole Guild are all my inventions. Keep, rename or replace?
2. **Bert** is the only Mole named so far. Does the second brother get a name?
3. **Is five swaps too many?** See above.
4. **Is "Bea's pies are fair test bakes" right?** The alternative is that she's secretly fond of Barnaby (gentler, but a bit more grown-up).
5. **Route placement** is only a suggestion until routes 6-15 exist.

# Design notes

All decisions below were made by **Caroline Azzone**, the design owner, standing in while Bagel is busy. They are her
sign-off.

## Board view

**Decided by Caroline, 2026-11-15: the tilted tabletop.** The board is drawn as a small table seen from a slight angle:
the tile layer is foreshortened vertically (a factor of 0.8), with a visible front edge for the board's thickness and a
soft shadow beneath it. Things that stand up (buildings, trees, Pip, parcel badges, the cursor) are not squashed; they
are drawn upright at their cell's projected position, back to front by row, so the board reads as a diorama. It is a 2D
projection.

The look is contained in `TILT` (and the table edge) in `src/ui/draw.ts` and the board drawing in `src/ui/board.ts`.
Setting `TILT` to 1 and `EDGE` to 0 gives back the flat board.

### How it works

- A 2D projection inside the board SVG, not a CSS 3D transform. The tile layer sits in one group
  (`#boardTilt`) with `scale(1 TILT)`.
- The flat grid logic is unchanged: the engine, solver, level data and saves know nothing about the tilt.
- Input goes through that group's screen matrix, so a tap lands on the tile drawn under the finger on every row, and a
  swipe's direction is decided in board space, not screen space.
- The slide arrows keep a tap target of at least 44 CSS px and stay outside the grid.
- Reduced motion and keyboard behaviour are unchanged.

### Portrait layout (implemented in #40)

**Decided by Caroline, 2026-11-15.** On a phone held upright: the **board on top**, with the **satchel as a compact
strip below** it, so the board gets the width of the screen and the parcels stay in view without pushing the board
down. Landscape is #41.

## Art direction

**Decided by Caroline, 2026-11-15: keep the current look.** The current sprite style and palette stay, with figures
upright. A full design-doc review comes separately.

- The SVG sprite style and palette: Fraunces for type, and the existing greens, creams and browns.
- Figures and buildings are drawn upright, which is what the tilted tabletop needs (see Board view).
- The style is flat-shaded and softly outlined, in a storybook manner.

## Seasonal light

**Decided by Caroline, 2026-11-15.** Each season gets its own light treatment to fit its theme, not golden hour all
year. The palette baseline stays for now.

Implemented in #65. Each village has a `season` (village data); the map sets `data-season` on the app root, so the
board, the village map and the shared sprite filters all read the same CSS custom properties (`src/styles.css`).
No new sprites. **Spring's tokens equal the original values, so spring looks exactly as before** (a test pins them).

| Token | Spring | Summer | Autumn | Winter | Used by |
| --- | --- | --- | --- | --- | --- |
| `--sky-hi` / `--sky-lo` | #eef3e3 / #dfe8d2 | #f6f1d6 / #ebe3bd | #f8ecda / #f0e2c8 | #e8eff4 / #d7e3ec | board stage gradient |
| `--tint` / `--tint-a` | #dfe8d2 / 0 | #ffe9a0 / .08 | #f0a050 / .10 | #bcd4ea / .12 | sky-tint overlay on the map |
| `--shadow` / `--shadow-a` | #2b2410 / .30 | #2b2410 / .36 | #3a2010 / .32 | #1f2a3a / .22 | drop-shadow filters (board `drop` is +.05) |
| `--sun-core` / `--sun-edge` / `--sun-a` | #fff1c2 / #ffd98a / .7 | #ffeeb0 / #ffd98a / .55 | #ffd9a0 / #ffb866 / .55 | #f2f7ff / #b4cae6 / .4 | highlight (sun) gradient on the map |

Summer is high and bright with short, strong shadows; autumn low, amber and long; winter pale and cool with soft shadows.
Reduced motion is unaffected (colour only). The seasonal contrast check in `tests/seasonal-light.test.ts` is a
**partial model**: it covers the map name plates under the sun overlay (at the plate position and at max alpha), the
stage and finish-overlay text, and the node icons. It does not yet model the vignette, worst-position sampling, the
selection ring or the stars. Sun alphas are kept low so no season makes the plates harder to read than spring. Full AA
verification, and the existing below-AA pairs in spring (plates, check on gold, lock on grey), are tracked in #95.

## Ending

**Decided by Caroline, 2026-11-15 (#26).** The closing scene is Old Barnaby's **Spring Supper** on the long table
(#58), where the four letter threads land. A **new village per season**: later seasons open a new village (Hollowmere
next) rather than extending this path. The village-transition flow is in #60 and #61: the next village appears, tap to
enter, a welcome intro, a per-village map, and Back to the previous village.

**Content (#58):** the closing scene is **Barnaby's Spring Supper**, live. The thank-you letter to Pip from #57 is
retired (its sentiment is the last beat). Each neighbour's thread pays off at the long table: the Moles' hatches steady
the legs, Marigold arrives for Clementine's carrots and confesses she buys her own (C4), Bea's test pie gets an honest
taster and Marigold's verdict, and Barnaby thanks Pip for carrying all of it. About 16 short lines, each under 140
characters. Every thread has a no-letters variant, so a player who read nothing still gets a coherent scene.

How it works:
- When lane 15 (`lastround`, the last Thistledown lane) is stamped, the closing scene plays after its door scene and
  letters.
- The scene is data in `src/door/ending.ts`. The hook is `withEnding` (`src/door/endingView.ts`), composed around the
  letters and door hooks in `src/main.ts`, cancellable like them.
- **One small engine change (#58):** a line may branch. A line is a string, or `{ say, if, otherwise }`, where `if` is
  `{ read: [letter ids] }` (any read) or `{ flag, is }` (a door-reply flag). `withEnding` resolves the lines from
  `loadLetters` and `loadDoorSave` when the scene starts (`resolveLines`, `src/door/ending.ts`). Branching is light:
  each thread has one line with a "letters read" and a fallback variant (moles: `tunnel-3`/`-4`; carrots: any carrots
  letter; supper: `supper-2`..`-5b`; fair: any fair letter), plus one line each for the swap flags `barnaby.pieBaker`,
  `bea.pudding` and `clementine.sundayNews`. The default (no reply) matches each swap slot's default letter.
- It plays once. "Seen" is saved (`bramblepost-ending-v1`) only when read through, so leaving mid-ending plays it again
  next time. Replaying any route never replays it. Reset clears it.
- Once seen, the map shows the whole path stamped and the line "Spring is done. Hollowmere next." The way into
  Hollowmere is the button below (#60).

## Villages (#60)

- Each neighbourhood has its own map: `slots` (lane positions), `scenery` (path start, post office, stream, trees) and
  `at` (where its fog sits on the maps before it). Thistledown's map is the first; Hollowmere has five hedged-in
  placeholder slots and a "Summer routes coming." note. Conker Corner and Snowberry End stay fog.
- The way into the next village is a real button, "Go to Hollowmere", over the fog. It opens when Thistledown is
  **complete: all its lanes stamped and the ending seen**. Stamped alone is not enough, because the ending plays when the
  last route is finished, so a player who has stamped it just plays that route once more. Before that it is fog.
- `onEnterVillage(id, firstTime)` runs before the new map shows, so the welcome intro (#61) can play first; the map waits
  for its promise. Entering uses a short fade-in, none under reduced motion. "Back to Thistledown" returns with focus
  on the entry button.
- The current village and the villages visited are saved (`bramblepost-current-village-v1`, cleared by reset). Continue on
  the title opens the current village. A saved village that is not open falls back to Thistledown.

## Letter threads

**Signed off by Caroline, with edits:**
- Keep Marigold, the Hollowmere Spring Fair, the Trestle & Tablecloth Co. and the Mole Guild.
- The Moles are Bert and Basil.
- Bea's pies are fair test bakes.
- Three door-reply swaps are kept: B2, B4, E3.

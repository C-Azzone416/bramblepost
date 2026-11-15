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
year. The palette baseline stays for now. Implementation is issue #65.

## Ending

**Decided by Caroline, 2026-11-15 (#26).** The closing scene is Old Barnaby's **Spring Supper** on the long table
(#58), where the four letter threads land. A **new village per season**: later seasons open a new village (Hollowmere
next) rather than extending this path. The village-transition flow is in #60 and #61: the next village appears, tap to
enter, a welcome intro, a per-village map, and Back to the previous village.

**Interim content:** the thank-you letter to Pip in this PR (signed by Clementine, Old Barnaby, Bea Thimblewick and
the Mole Bros) stands in until #58 is written from the signed-off letters. It invents no neighbour secrets.

How it works:
- When lane 15 (`lastround`, the last Thistledown lane) is stamped, the closing scene plays after its door scene and
  letters.
- The scene is data in `src/door/ending.ts`; `#58` swaps the entry without code changes. The hook is `withEnding`
  (`src/door/endingView.ts`), composed around the letters and door hooks in `src/main.ts`, cancellable like them.
- It plays once. "Seen" is saved (`bramblepost-ending-v1`) only when read through, so leaving mid-ending plays it again
  next time. Replaying any route never replays it. Reset clears it.
- Once seen, the map shows the whole path stamped and a note, "Spring is done. Hollowmere next", by Hollowmere's fog.
  Hollowmere stays locked; the note is its own element (`vnextnote`) so it can later become the way into the next
  village (#60, #61).

## Letter threads

**Signed off by Caroline, with edits:**
- Keep Marigold, the Hollowmere Spring Fair, the Trestle & Tablecloth Co. and the Mole Guild.
- The Moles are Bert and Basil.
- Bea's pies are fair test bakes.
- Three door-reply swaps are kept: B2, B4, E3.

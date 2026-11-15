# Design notes

## Board view

**Decision (2026-11-15): the tilted tabletop.** The board is drawn as a small table seen from a slight angle: the tile
layer is foreshortened vertically (a factor of 0.8), with a visible front edge for the board's thickness and a soft
shadow beneath it. Things that stand up (buildings, trees, Pip, parcel badges, the cursor) are not squashed; they are
drawn upright at their cell's projected position, back to front by row, so the board reads as a diorama.

**Status: the user's choice, pending Caroline's confirmation.** The user picked this (relayed by Scout, issue #27).
Board and art design are Caroline's area, so she should be told. It is recorded as an assumption she can overturn;
if she does, the change is contained in `TILT` (and the table edge) in `src/ui/draw.ts` and the board drawing in
`src/ui/board.ts`. Setting `TILT` to 1 and `EDGE` to 0 gives back the flat board.

### How it works

- A 2D projection inside the board SVG, not a CSS 3D transform. The tile layer sits in one group
  (`#boardTilt`) with `scale(1 TILT)`.
- The flat grid logic is unchanged: the engine, solver, level data and saves know nothing about the tilt.
- Input goes through that group's screen matrix, so a tap lands on the tile drawn under the finger on every row, and a
  swipe's direction is decided in board space, not screen space.
- The slide arrows keep a tap target of at least 44 CSS px and stay outside the grid.
- Reduced motion and keyboard behaviour are unchanged.

### Portrait layout (rough, implemented in #40)

On a phone held upright: the **board on top**, with the **satchel as a compact strip below** it, so the board gets the
width of the screen and the parcels stay in view without pushing the board down. Landscape is #41. This section only
records the intent; #51 does not change the page layout.

## Art direction (baseline)

**Decision (2026-11-15): keep the current look.** This is the user's choice, recorded as an assumption that Caroline
can overturn (board and art design are her area). It is a baseline, not a new art style.

- Keep the current SVG sprite style and palette: Fraunces for type, and the existing greens, creams and browns.
- Figures and buildings are drawn upright, which is what the tilted tabletop needs (see Board view).
- The style is flat-shaded and softly outlined, in a storybook manner.

A full design-doc review comes in a separate issue; until then this section is the baseline and nothing here changes
the art.

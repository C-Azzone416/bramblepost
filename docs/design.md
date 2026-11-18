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
Reduced motion is unaffected (colour only). `tests/seasonal-light.test.ts` is an **analytic estimate** of WCAG AA
(4.5 text, 3 icons and rings) in every season, not a check of rendered pixels. It composites a fixed list of ground
colours (meadow stops, lane, hedge, trees, water, fog, flowers) under the sun at its true alpha at each sampled position
(and a max-alpha case) and the vignette; the season tint is applied only to the meadow stops, because the lanes and scenery
are painted after it, then puts the plate, star pill or ring on top; plates are sampled
across their full area and the ring around every lane slot. The colours it uses come from `src/village/look.ts`, which
`map.ts` draws with; `tests/map-look.test.ts` renders the map (Thistledown and Hollowmere) and checks the drawn attributes and
computed CSS fills against those same values. Autumn and winter villages have no enterable map yet, and none of these colours depend on the season. **Limits:** it does not include the
cottage and tree sprites' own colours, anti-aliasing, drop-shadow filters, the fog's own alpha, or lane `opacity`
blending, and ground colours that aren't on its list are not covered.

**Rendered check (#99, #106): the authoritative contrast measurement.** `tests/phone/contrast.spec.ts` (`npm run phone-pass`, WebKit and
Chromium, standard pack only, runs in CI in the `phone-pass` job) measures the painted page, so the vitest model above is only a
fast estimate. Every text, icon and ring in the map view and the board is found in the DOM (the only allow-list is illustration
sprites: Pip, houses, neighbours, ambient props, parcel pictures), and icons are matched by role, not by exact sprite (a rimmed star
is still a star). Each view is rendered as painted (V), with every target hidden (H), with every target painted solid black and
solid white (the black/white difference gives each pixel's coverage exactly, whatever the colours), and, for the ring, with only its
dashes hidden (D). Elements that are not painted (opacity 0, hidden, display none) are skipped; disabled controls are exempt.
- **Text:** the painted region is every pixel the text covers at all (coverage 0.1 or more, so a dimmed or partly faded glyph still
  covers it). Edge pixels, which are blends with the background by geometry, are those covered clearly less than a neighbour; every
  other pixel is measured as painted against the background beside and under it, 4.5:1, with no allowance and no best-covered subset.
  A faded stretch of a glyph is faint all over, so it is measured, and it fails. Blurred glyphs (the open node's number under the map's
  drop shadow) are measured as a player sees them.
- **Icons (WCAG 1.4.11, non-text contrast: a graphic against its adjacent colours):** the outer boundary of the painted region, a
  band 2px wide inside its edge, every pixel of it against the ground just outside the region (within 4px), 3:1, with no allowance.
  The interior is not measured against the ground, so a gold fill inside a dark rim is legitimate, and a thin dark rim passes on its
  edge. A faded stretch of the edge fails, and so does a rim with a gap (the fill's own edge becomes the boundary).
- **Ring:** the expected dash pattern comes from one more render (R) with only the dashes forced to solid black, compared with D
  (dashes hidden); it is not taken from the render under test. A pixel belongs to a dash when it is covered at all and is not a partly
  covered edge pixel (the text rule); a bin (120 of 3 degrees) with at least two such pixels is an expected dash bin. On the real render
  every expected dash bin is measured on those pixels as rendered: its dash against its halo (3:1) and the better of dash and halo
  against the ground beside it (3:1). A missing or faint segment fails directly; there is no global threshold and no gap tolerance.
- **Expected set:** counts come from the seeded game state, the page's own lists and, on the board, the route data and the engine (the
  last spring route in its solution order, played by keyboard to its first delivery, so the board has a check and a lock): badges,
  checks and locks are the parcels to deliver, delivered, and latched signed letters. The map HUD (season, title, stamp and star text
  and icons) is checked against the state's text. A target cut off by a container does not count as present.
It covers the actual Thistledown map (spring), the actual Hollowmere map (summer) and a board. **Autumn and winter are emulated** by
setting `data-season` on the root over the Thistledown map until those villages have maps, so only their lighting is covered, not their
layouts. Its checks were proved by mutation (each fails): plate text made invisible, the ring removed, the HUD counts removed, half of
each plate name made low contrast, the right 40% of an icon (edge included) faded, a dark rim with gaps (while the same rim without
gaps passes), and one ring dash made low-contrast and one made fully transparent (a permanent test in the spec, `one damaged ring dash fails`). The Today callout, Pip and the finished nodes' star pills are kept clear of each other and of the other node markers
(`placeMarkers` in `src/village/pip.ts`, checked on every village layout and state in `tests/map-overlap.test.ts`), and the rendered check
fails if any map element is covered by the callout or Pip (#103).

**Known findings (the baseline).** The strict measurement finds contrast shortfalls in the existing UI, not caused by it. They are listed
per phone project, per element and per season in `KNOWN_FINDINGS` in the spec, each noted `#113` (the contrast fix) or `new` (found by
#114, to be filed). Anything not listed must pass AA; a measurement failure is never excused; and in CI an entry whose element passes in a
listed season fails the test, so the list cannot go stale at that granularity. **CI is the only authority:** the list is the baseline for
the Linux runner (ubuntu-latest), and the known/stale comparison runs only when `process.platform === "linux"`; a local macOS run prints
the same table of rows but does not fail on that comparison (text renders slightly differently there).

*Ring ruling (#99/#102):* the selection ring is a dashed two-tone indicator (navy dashes on a cream halo). The rendered check
requires, per expected dash bin (the pattern comes from a reference render with the dashes forced black), (i) the dash against its
halo at 3:1 or better, and (ii) the better of the dash and halo colours against the adjacent ground at 3:1 or better. Gaps are not
judged against the ground: in a dashed indicator the dashes are the contrasting area and gaps read as gaps; the halo's role is
separation on dark ground. Colours are measured as rendered (the open node's pulse circle is drawn over the ring).
Legibility changes made for this (the meadow, light and shadows are unchanged): name plates are drawn above the sun and
vignette, the plate note is cream (#f7e9c6), the stamp check and locked-node padlock are dark, the selection ring is a
dark navy with a cream halo, completed-node stars sit on a dark pill, and the chip number on gold and locked chips use
darker text.

## Ending

Each village may have a finale supplied by the active content pack. Spring uses the top-level ending;
later seasons use `seasons.<season>.ending`. The finale follows the final route's door scene and letters.
Spring closes its season, while winter closes the year. A village with no finale is complete once all
its lanes are stamped; otherwise its finale must also have been read through.

`withEnding` wraps the door and letter hooks in `src/main.ts`. It resolves each text's first matching
variant using the saved letters and door flags, then displays the resolved lines in order. Seen state is
stored per finale in `bramblepost-ending-v1`; the original spring flag remains compatible. Leaving before
reading through allows the finale to play on the next finish. Once read, it does not replay on an ordinary
route replay, and resetting progress clears the state. The map names the next village at each season close
and uses a neutral year-end line for winter.

## Villages (#60)

Every village has exactly 10 routes (lanes); Thistledown is trimmed from 15 in #121.

- Each neighbourhood has its own map: `slots` (lane positions), `scenery` (path start, post office, stream, trees) and
  `at` (where its fog sits on the maps before it). Thistledown's map is the first; Hollowmere has ten hedged-in
  placeholder slots and a "Summer routes coming." note. Conker Corner and Snowberry End also have ten placeholder slots.
- The way into the next village opens when the current village is complete: all lanes stamped and, if supplied, its finale read. Before that it is fog.
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

## Contrast tokens (#113)
The rendered check (#106) found existing text and icons under AA. The fixes keep each hue; only lightness moves, and only as far as 4.5:1 (text) or 3:1 (icons) needs. Spring's meadow and light are unchanged.

| Token / rule | Was | Now | Why |
| --- | --- | --- | --- |
| `--muted` (src/styles.css) | `#8a8c7a` | `#666759` | The "/ par", "/ N stamps", "/ N stars" text and the locked-season label. Same olive-grey hue. |
| `--moss-ink` (new, text only) | (`--moss` `#5f7d43`) | `#4d6536` | Season label and route-number label on the map and board (were 4.48 and 3.69). `--moss` itself is unchanged for fills and rings. |
| `--postal-ink` (new, text only) | (`--postal` `#c4452e`) | `#b43f2a` | The lane panel's `.eyebrow` (was 4.45). |
| `--honey-ink` (new, text only) | (`--honey` `#e3a43a`) | `#8c5f14` | The satchel ordinal `.ord` (was 2.18). |
| `.vseason.locked`, `.vseason.soon` | `opacity: .7` | card colour `#ece5d2`, title in `--ink-soft` | Dimmed by colour, not opacity, so the text keeps its contrast. |
| `rbStarRim`, `rbStarOffRim` (new symbols) | `rbStar` / `rbStarOff` | gold / cream fill kept; dark rim `#5a3508` / `#6b5a36`, 3.4 wide in the 48 viewBox | Stars on light grounds: the map's lane chips, the lane panel, the HUD. Stars on the map's dark pill keep the original symbols (a dark rim would vanish against the pill). Use `starRow(n, true)` for the rimmed row. |
| `icoCheckHud` (new symbol) | `icoCheck` (cream ring) | gold fill kept; dark ring `#5a3508` (3 wide) and dark check | The HUD stamp icon only. The board's and satchel's stamps keep `icoCheck`. |
| `--muted-locked` `#5a5b4d` | (`--muted` `#666759`) | scoped to `.vseason.locked small, .vseason.soon small` | The locked season-card label on `#ece5d2` (4.32 in CI). Same olive-grey hue, 5.17 in CI. The global `--muted` is unchanged. |
| `.tea .count span` | `--muted` `#666759`, weight 500 | `--muted` unchanged, weight 600 | The "· par N" on the tea pill. Thin glyphs at weight 500 measured 2.5 to 3.3 in CI; at weight 600 the same colour measures 5.00 (worst, pixel-landscape) or better. Weight only, no new colour. |
| `.pc.got` (delivered satchel row) | `opacity: .62` | row `#f3efe2`, icon tile `#f1e6c9`, title `--ink-soft`, line `--muted`, ordinal `--honey-ink`, status `--moss-ink` / `--postal-ink` | A delivered row is dimmed by colour on its parts, not by opacity, so each part keeps AA (ordinal was 2.57 in CI, now 4.81). |

The rendered check (#114, round 2) measures an icon's outer edge band against the ground (WCAG 1.4.11). Measured rims: the lane-chip stars are the limiting case (smallest, in landscape): a 2.5 rim in the 48 viewBox gave 1.6, 2.8 gave 2.1, 3.0 gave 2.9, and 3.4 gives 4.5 or better on all four phone projects. The HUD stamp's ring (28 viewBox, 3 wide) passes at 9.7.

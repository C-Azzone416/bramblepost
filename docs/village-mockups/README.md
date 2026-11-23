# Final village mockups

**Picked by Caroline, 2026-11-17.** These are the look-and-feel targets for the three later villages' maps
(#127 Hollowmere, #128 Conker Corner, #129 Snowberry End) and their map art (#136). Each map starts at its own
post office (#141). The maps were built from them in the game's own sprites and data; keep using them as the reference
for layout, palette and mood.

| File | What it is |
| --- | --- |
| `hollowmere.svg` | Summer map: the mere, with sunflowers |
| `conker-corner.svg` | Autumn map: chestnut wood, with the windmill |
| `snowberry-end.svg` | Winter map: the ice lake, with a boardwalk out to a fishing-hut stop |
| `layouts.json` | Start, post office, the 10 lanes (stop and `via` point each) and each stop's house, per village |

All three use the game's map space, 1000 × 640 (`MAP_W` × `MAP_H` in `src/village/data.ts`). A lane in
`layouts.json` has the same shape as `Lane` in the game: it runs from the previous stop (or `start`) to its stop as a
quadratic curve through `via`. Each village has 10 routes (#122). In the mockups stops 1 to 3 are done, stop 4 is
today's and 5 to 10 are locked, only to show all three lane states.

## Rules the art keeps

From Caroline's feedback on the mockups. Keep them in the real maps.

- No dotted bushes. Bushes are lumpy leafy clumps.
- Water never reads as a road: banks, ripples and reeds, and no lane colour.
- Nothing sits on a lane, and nothing floats. Every prop has its base on the ground.
- Hills and mountains stay low and soft. They never overpower the lanes.
- The current storybook style: flat-shaded, softly outlined, upright figures and buildings, Fraunces for type
  (see Art direction in `docs/design.md`).

## Post offices (#141)

Each village has its own post office, drawn to match its houses, in the same style as the stump post office in
`src/ui/sprites.svg` (`#rbPO`): a red envelope sign over the door and a red post box beside it. In the game they are
the `poHollowmere`, `poConker` and `poSnowberry` sprites, placed by each village's `postOfficeAt`. A route starts at
the post office, and a short footpath runs from its door to the first lane. The mockup shows one spot for it; #141
allows the spot to change from route to route.

| Village | Post office | In the mockup |
| --- | --- | --- |
| Hollowmere | Thatched cream cottage, golden thatch, sky-blue door, window boxes of yellow and pink flowers | (916, 520), post box on the right |
| Conker Corner | Round chestnut-wood house under an acorn-cap roof, green door, three fallen leaves on the roof | (74, 492), post box on the left |
| Snowberry End | Log cabin with a deep snow roof, icicles, lit windows and chimney smoke; the post box has a snow cap | (76, 158), post box on the left |

Positions are the building's base centre at scale 0.82. Each is a little bigger than a house so it reads as the
start.

## Hollowmere (summer)

- **Ground:** warm yellow-green (`#e9e08e`, `#c8cf6a`, `#a7b452`) with white, red and yellow flower specks.
- **Lanes:** sandy, edge `#c49a5a`, fill `#f3dfa6`, locked dots `#fff3d0`.
- **Water:** a round mere in the middle (`#9fe0e8` to `#4aa0bc`) with a sandy shore, lily pads, reeds, a jetty and
  a red sailing boat.
- **Houses:** strawberry houses, beehive skeps, flowerpots and one boathouse.
- **Route:** starts at the post office in the bottom right and runs west along the south shore, up the west side and
  back east along the north, ending toward the next village's fog in the top right.
- **Twist hook (#124, sunflowers turn):** sunflower patches stand beside six lanes. Two carry a turn arrow, beside
  lanes 5 and 9, as the hint for where a turning sunflower matters.

## Conker Corner (autumn)

- **Ground:** amber and ochre (`#d8b86a`, `#c4974a`, `#a8763a`) with fallen-leaf specks (`#d0672f`, `#e8913a`,
  `#f6c45a`, `#a8501f`).
- **Lanes:** edge `#9a6a3a`, fill `#ecd3a2`, locked dots `#f7e6c4`.
- **Water:** a pale brook from a spring pool at the top, running south through the wood (`#d4ece8` to `#8fc3c4`),
  with pebbles, stepping stones and a plank footbridge where lane 6 crosses it.
- **Houses:** conker houses, hollow logs and pumpkins. A windmill on the east bank of the brook, and a fenced
  pumpkin patch with a scarecrow on the east edge.
- **Route:** starts at the post office on the left, zigzags north on the west bank, crosses the footbridge and
  ends on the east side, toward the next village's fog in the bottom right.
- **Twist hook (#125, autumn gusts):** two leaf gusts blow across lanes 4, 7 and 8, as the hint for where a gust
  matters.

## Snowberry End (winter)

- **Ground:** snow (`#eef3f6`, `#e0e8ef`, `#cfdbe5`) with a few sparkles and thawed earth patches.
- **Lanes:** plank boardwalks, edge `#7d6448`, fill `#c8b08a`, locked dots `#93a8bd`.
- **Ice:** a frozen lake in the middle (`#d8eef6` to `#9ec8dc`) with a bay to the south. `layouts.json` gives its
  outline as `lakeOutline`.
- **Houses:** stone cottages, log cabins and pinecone houses. Stop 3 is an ice-fishing hut out on the lake. Two more
  fishing huts, a skating ring, a jetty, frosted reeds, firs, snowy shrubs, lanterns and a bench.
- **Route:** starts at the post office in the top left, runs east along the north shore, out over the ice on a
  boardwalk to the hut at stop 3 and back, round the east side and west along the south shore.
- **Twist hook (#126, ice slide):** planks over ice are safe, bare ice slides. Lanes 3 and 4 are boardwalk over the
  ice. Lane 10 crosses bare ice in the bay, where a slide arrow shows Pip sliding.

## Where it landed

- The three maps are built (#127, #128, #129), with the seasonal house styles and the post offices at the positions
  above (#141). The next village's fog uses `seenFrom` in `src/village/data.ts`.
- Each season's own meadow and tree palette is still open in #136.
- The board-view tiles and the other options stay on the mockups canvas; only these three maps are final.

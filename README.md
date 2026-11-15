# Bramblepost

A cosy tile-sliding puzzle. The hedgerows moved overnight, and Pip the hedgehog postman needs the lanes fixed before he can do his rounds. Turn and slide garden tiles until Pip can walk from door to door, in the order his satchel says, before the teapot runs dry.

This is the spring playtest: five routes in Thistledown, with pars checked by a solver.

## Run it

You need Node 22 or newer (`node -v` to check; there's an `.nvmrc` if you use nvm).

```sh
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs every test once (about 25 seconds) |
| `npm run test:watch` | Re-runs tests as you edit |
| `npm run typecheck` | TypeScript check only |
| `npm run build` | Typecheck, then build a static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run solve -- <id>` | Solver report for a route: par for every satchel order and a par solution line |
| `npm run budget -- <id>` | Fewest moves for every order with the teapot limit applied |
| `npm run gen -- <layout> <par> <from> <to>` | Search random seeds for new boards with a given par |
| `npm run scramble -- <name> <k> <par> <from> <to>` | Scramble a solved board k moves and keep the ones with a given par |

Leave off the route id to run `solve` or `budget` on every route. Hollow Lane takes about a minute.

## Checks

Every pull request runs typecheck, tests and build in GitHub Actions (`.github/workflows/ci.yml`) on Node 22.22. A failing check marks the PR red.

## Rules in the build

- **Turn** a tile a quarter turn (tap, or R/Q on the keyboard). **Slide** a row or column one space (swipe, the red arrows, or Shift+arrow); the end tile wraps around.
- **Rooted tiles** never slide: houses, the post office, trees and water. Slides skip over them. **Footbridges** turn but never slide. Flowerbeds slide but have no lane.
- **Satchel order** is set before the first move and locks then. Pip sets off the moment the next stop connects. The cat always rides last. A signed letter's gate opens only after its key holder has had their post.
- **Tea:** each move pours a cup. The pot holds par + 4. If it runs dry with post still in the satchel, Pip heads home for a fresh pot (Restart, or Undo the last move). Warnings show at 2 cups and the last cup.
- **Village map:** the game opens on Thistledown. Each finished route stamps its lane with its best stars, and the next lane opens. Summer, autumn and winter wait under fog until their routes exist. "How to play" on the map opens the full route list.
- **Stars:** 3 for par with a warm pie, 2 within par + 2 (a cold pie caps the route here), 1 for finishing before the pot runs dry. Best stars are saved in the browser's localStorage.

## After a route: the door scene

Finishing a route (not each parcel) plays a short scene at one neighbour's home: Pip stays for tea, the neighbour says a few lines (typed out with gibberish blips for a voice), and you pick one of two kind replies. There is no wrong answer. The reply is saved as a flag that later scenes and letters can read. The scene also shows the route's stamp, which belongs to the village map: a route is stamped once it has a saved finish. Continue then shows the Route complete card, and leaving it goes back to the map.

- `src/door/scenes.ts`: the spring scenes (host, lines, replies, flag, stamp art). A line can have variants, e.g. for a cold pie or an earlier reply.
- `src/door/save.ts`: saves to localStorage key `bramblepost-door-v1` as `{ flags, voices }`. Other features can read it with `loadDoorSave()`.
- `src/door/view.ts`: the scene on screen, and `doorAfterRoute()`, the hook `src/main.ts` passes to the game as `afterRoute`.

## Project layout

```
index.html            page shell and fonts
src/
  main.ts             entry point: mounts the game into #app
  styles.css          all styling
  engine/             the rules, with no DOM: safe to use from node, tests and tools
    types.ts          Board, Move, Parcel, Puzzle
    board.ts          grid parsing, tile rotation, slides, Pip's pathfinding
    satchel.ts        delivery order rules and the delivery chain
    solver.ts         breadth-first solver for par
    scoring.ts        teapot size, star tiers, out-of-tea rule
  levels/             routes as data
    types.ts          the Route shape
    spring.ts         the five spring routes, each with par and a par solution
    index.ts          ROUTES: the list the game shows
  village/            the village map you walk between routes
    data.ts           neighbourhoods by season, lane and house positions on the map
    progress.ts       which lanes are stamped, open or locked (no DOM)
    save.ts           village save: stamps already shown (own localStorage key)
    map.ts            draws the map, lane list and side panel; starts a route
    village.css       map styling
  ui/                 everything on screen
    game.ts           game state, moves, route list and wiring (startGame, GameOptions, GameApi)
    board.ts          board view: SVG drawing, Pip's walk, tap / swipe / keyboard input
    satchel.ts        satchel panel, tea cups, move count and banner
    finish.ts         Route complete and out-of-tea cards
    draw.ts           tile and Pip artwork
    cast.ts           neighbours and parcel looks
    save.ts           saved stars
    svg.ts            small DOM helpers
    mount.ts          puts sprites and layout on the page, starts the game
    layout.html       page markup
    sprites.svg       Pip, houses, icons and gradients as SVG symbols
tests/
  engine.test.ts      rules and solver unit tests
  levels.test.ts      every route: stored solution works, par is the true minimum
  ui.test.ts          plays the real page in jsdom (finish card, cold pie, out of tea, undo, saves)
  village.test.ts     map data, lane unlocking and the village save
  map.test.ts         plays the village map in jsdom (locked lanes, stamps, reload)
tools/                level-design scripts (solve, budget, gen, scramble)
```

## Adding a route

1. Add an entry to `src/levels/spring.ts` (or a new season file, added to `ROUTES` in `src/levels/index.ts`), then give it a lane in `src/village/data.ts` (its id in a neighbourhood's `routes`, and a spot in `LANES`). Grid tokens are listed above `parse()` in `src/engine/board.ts`.
2. Run `npm run solve -- <id>` and copy the par and the `solution` line it prints into the route.
3. Run `npm test`. The level tests fail if the par or solution drift from what the solver finds.

A new tile type or parcel rule goes in `src/engine` first (with a test), then its artwork in `src/ui/draw.ts` and `src/ui/sprites.svg`.

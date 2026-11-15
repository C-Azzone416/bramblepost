# Bramblepost 0.2.0 (draft)

## Spring content

- Spring routes 6 to 15 (#45, #47, #48, #49). Pars are solver-proven: routes 8 to 15 are par 5 to 6, and difficulty comes from rule mixes.
- Spring letter threads (#66).
- Door-reply swaps: replies choose which envelope arrives next (#74).
- The ending, with the interim thank-you letter (#64).

## Front door

- Title screen with Continue (#37).
- New Game on the title screen (#63).
- Settings (#39).
- Village Album (#38).

## Look and feel

- Tilted tabletop board (#54).
- Door-scene portraits (#62).
- Board figures and neighbour step-out (#72, #69).
- Sound (#33).

## Phones

- Touch-first input (#34).
- Real-browser phone pass (#43).
- Portrait layout (#68).
- Landscape layout (#75).
- Finger-sized map tap targets (#44).

## Under the hood

- CI: typecheck, tests and build on every pull request (#28).
- One save module with versions and a reset (#30).
- Split `game.ts` into board, satchel and finish modules (#29).
- Room on the map for 15 lanes (#31).
- Letter threads as data, and carry and read letters (#35, #36).
- Fixes (#46, #50, #71).

## Not in this release

- Ambient life, with placeholder art (issue #52, PR #73, still open).
- Village transitions (issue #60, PR #76, still open).
- Welcome intro (#61).
- Seasonal light (#65).
- Spring Supper scene (#58).
- Final ambient art (#10).

## Before releasing to main

- [ ] Real-device check on an iPhone and an Android phone:
  - Tilted board taps and swipes.
  - Portrait and landscape layouts.
  - Safe areas and notch.
  - Sound after the first tap.
  - Safari toolbar.
- [ ] The user's explicit go-ahead.

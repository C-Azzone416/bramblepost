# Bramblepost 0.3.0 (draft)

## Spring

- Door replies, tucked notes and letter versions: replies choose what arrives next, notes ride on other parcels, and letters have several versions (#88, #89, #90).
- The closing scene plays after the last spring route (#80).
- A welcome intro the first time you enter a village (#94), and you can replay it from the Album (#101).
- Seasonal light for each village (#93).

## Villages and the map

- Village transitions: enter Hollowmere, its own map, and Back (#76).
- The map only teases the next season, not every season ahead (#119).
- Hollowmere, Conker Corner and Snowberry End each have 10 placeholder lanes, ready for their routes (#149).

## Look and feel

- Ambient life on the map: smoke, laundry and fireflies (#73, #81).
- Map polish: the Today callout and Pip keep clear of the star pills, Pip stays on the map, and laundry posts are placed better (#109, #112).

## Accessibility

- Text and icons on the map and board reach WCAG AA contrast (#98, #115).
- A rendered-pixel contrast check runs on real phone browsers in CI (#102, #114).

## Phones

- Decorative fog no longer blocks taps (#107).
- The real-browser phone pass runs in CI (#108, #110).

## Fixes

- Satchel controls can no longer put the cat anywhere but last (#116).
- Route controls stay consistent while a delivery plays (#117).

## Under the hood

- Content packs: a pack switch, saves per pack, encoded packs with leak checks, structure checks, and room for every season (#84, #87, #91, #92, #97, #145, #150).
- Engines for the later seasons' rules: sunflowers that turn, autumn gusts and the frozen stream (#146, #151, #152). They're not playable yet; no route uses them.
- Docs and a back-merge of 0.2.0 (#82, #83, #85, #86).

---

# Bramblepost 0.2.0

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

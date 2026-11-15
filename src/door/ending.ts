/**
 * Closing scenes, as data. When `route` is finished (after its door scene and letters) and the
 * ending hasn't been seen, its scene plays once.
 *
 * Right now this is the fallback: a thank-you letter to Pip from the whole lane (#57). It is an
 * assumption Caroline can overturn, see docs/design.md. Barnaby's Spring Supper (#58) replaces it
 * by changing this entry (or pointing `route` at it from a new one); the hook in endingView.ts
 * doesn't change. Keep each line under 140 characters. No neighbour secrets here: #8 is unapproved.
 */
export interface EndingScene {
  /** The route whose finish triggers it. */
  route: string;
  /** Small line above the heading. */
  kicker: string;
  title: string;
  /** What the envelope looks like on the outside. */
  envelope: string;
  /** One line per entry; the last is the sign-off. */
  lines: string[];
}

export const ENDING_SCENES: EndingScene[] = [
  {
    route: "lastround",
    kicker: "The end of the path",
    title: "A letter for Pip",
    envelope: "Addressed in four different hands, and one muddy paw print",
    lines: [
      "Dear Pip, Clementine says you're to read this sitting down. The kettle is on, as it always is.",
      "Every lane in Thistledown has had your footprints on it this spring, and a few have had crumbs.",
      "You carried our post, our parcels and, frankly, our nerves, and you got every one of them to the right door.",
      "Old Barnaby wishes it known that he was not waiting at the gate. He was merely standing near it. Daily.",
      "The Mole Bros. send a muffled thank-you and two new tunnels, which they promise are not under your house.",
      "Bea Thimblewick says the lavender by her door is yours whenever you pass. She also says that is always.",
      "Spring is done, but the path will keep. Thank you, Pip. Mind the puddles on your way.",
      "With love, Clementine, Old Barnaby, Bea Thimblewick and the Mole Bros.",
    ],
  },
];

export const endingFor = (scenes: EndingScene[], route: string): EndingScene | undefined => scenes.find((s) => s.route === route);

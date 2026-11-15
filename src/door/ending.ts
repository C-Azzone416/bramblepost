/**
 * Closing scenes, as data. When `route` is finished (after its door scene and letters) and the
 * ending hasn't been seen, its scene plays once.
 *
 * Barnaby's Spring Supper (#58) is the closing scene: the long table where the four letter threads land
 * (docs/design.md "Ending", docs/letters.md). It replaced the thank-you-letter fallback from #57; the hook in
 * endingView.ts is unchanged apart from resolving branching lines (below).
 *
 * Lines can branch, lightly. A line is a plain string, or `{ say, if, otherwise? }`: `say` plays when the
 * condition holds, else `otherwise` (or nothing). A condition is `{ read: [...] }` (any of those letters read)
 * or `{ flag, is }` (a door-reply flag has that value). Every thread's line has an `otherwise`, so a player who
 * read nothing still gets a coherent scene. Keep each line under 140 characters.
 */
export interface EndingState {
  /** Letter ids read (loadLetters). */
  read: readonly string[];
  /** Door-reply flags (loadDoorSave). */
  flags: Readonly<Record<string, string>>;
}

export type EndingCond = { read: string[] } | { flag: string; is: string };
export type EndingLine = string | { say: string; if: EndingCond; otherwise?: string };

export interface EndingScene {
  /** The route whose finish triggers it. */
  route: string;
  /** Small line above the heading. */
  kicker: string;
  title: string;
  /** What the envelope looks like on the outside. */
  envelope: string;
  /** One line per entry (some branch); the last is the sign-off. */
  lines: EndingLine[];
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function condHolds(c: EndingCond, st: EndingState): boolean {
  if ("read" in c) return c.read.some((id) => st.read.includes(id));
  return has(st.flags, c.flag) && st.flags[c.flag] === c.is;
}

/** The lines this player gets: branches resolved, lines with no matching text dropped. */
export function resolveLines(lines: readonly EndingLine[], st: EndingState): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (typeof l === "string") out.push(l);
    else {
      const t = condHolds(l.if, st) ? l.say : l.otherwise;
      if (t !== undefined) out.push(t);
    }
  }
  return out;
}

/** The letters that make each thread's payoff line play (any one of them). */
const MOLES = ["tunnel-3", "tunnel-4"];
const CARROTS = ["carrots-1", "carrots-2", "carrots-3"];
const SUPPER = ["supper-2", "supper-3", "supper-4", "supper-5", "supper-5b"];
const FAIR = ["fair-1", "fair-2", "fair-2b", "fair-3"];

export const ENDING_SCENES: EndingScene[] = [
  {
    route: "lastround",
    kicker: "The end of the path",
    title: "Barnaby's Spring Supper",
    envelope: "One very long table, set for the whole lane. One chair has a name card, and the name is Pip.",
    lines: [
      "On the last Sunday of spring, Barnaby's table runs the whole length of the lane, with a chair for everyone and a few spare.",
      {
        if: { read: MOLES },
        say: "The cobbles are lumpy, but not one leg wobbles. Bert and Basil have a hatch under each, and the Committee has signed for them.",
        otherwise: "The cobbles are lumpy, yet the table never wobbles. Underneath, two moles are being very quiet and very pleased.",
      },
      {
        if: { read: CARROTS },
        say: "Marigold has come to admire Clementine's carrots, as promised. Clementine shows her the bed: one carrot, standing alone, with a flag.",
        otherwise: "Marigold has come all the way from Hollowmere to see Clementine's carrots, and the whole lane holds its breath.",
      },
      "Pip is steered by a dozen paws to the chair in the middle, which has a name card in Barnaby's very best handwriting.",
      {
        if: { read: SUPPER },
        say: "Barnaby rises in his good waistcoat. 'Twelve chairs, one very long cloth, a surprise for Pip. I cannot cook, so I wrote many letters.'",
        otherwise: "Barnaby rises in his good waistcoat. 'Welcome to my surprise,' he says. 'It is for Pip. I cannot cook, so I asked the whole lane.'",
      },
      {
        if: { flag: "barnaby.pieBaker", is: "told" },
        say: "'The pies,' Barnaby adds, 'are Miss Thimblewick's.' Bea goes pink to the ears, and the table claps softly, so as not to startle her.",
        otherwise: "'And thanks to the Baker, whoever she is,' he adds. Every head turns to Bea, who studies her spoon very hard.",
      },
      "Then comes Bea's pie, carried in with a tremble. 'A test bake,' she whispers. 'Please be honest.' Barnaby has been, all spring.",
      {
        if: { flag: "bea.pudding", is: "letter" },
        say: "Pudding, who ate a letter this spring, sits under Barnaby's chair and is forgiven by everyone. He is not sorry.",
        otherwise: "Pudding supervises the pie from the end of the table, quite certain that he is the postmaster of it.",
      },
      {
        if: { read: FAIR },
        say: "Marigold, judge of the Hollowmere Fair pies, takes a second slice 'for rigour'. Verdict: honest, buttery, and no fainting required.",
        otherwise: "Marigold takes a second slice 'for rigour'. Her verdict: honest, buttery, and entirely worth all of Bea's trembling.",
      },
      "Over the soup, Marigold confesses that she buys her own carrots at market and has never grown one. Clementine laughs until she hiccups.",
      {
        if: { flag: "clementine.sundayNews", is: "tell" },
        say: "Clementine, in on it all along, winks at Pip. 'I had it from the rounds,' she says. 'I have been extremely good about it.'",
        otherwise: "Clementine declares she had no idea, three times, with her hand on her heart. Pip, loyal to the satchel, says nothing.",
      },
      "Bert and Basil surface through a hatch beside Pip's chair, brushing soil off the cloth. 'Not under your house,' says Basil. 'Mostly.'",
      "Then they all say it at once: thank you, Pip, for the post, the parcels, and for getting every one of us to the right door.",
      "Spring is done, but the path will keep. Thank you, Pip. Mind the puddles on your way.",
      "With love, Clementine, Old Barnaby, Bea Thimblewick and the Mole Bros.",
    ],
  },
];

export const endingFor = (scenes: EndingScene[], route: string): EndingScene | undefined => scenes.find((s) => s.route === route);

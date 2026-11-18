/**
 * The spring letter threads (#8), as data. The story notes and placement table are in docs/letters.md.
 *
 * Four threads. Three slots swap on a door reply (#9, SPRING_SLOTS below); the other slots hold one letter:
 *   fair (Bea's test pies), tunnel (the Moles' network), supper (Barnaby's long table), carrots (Clementine's sister).
 * Every letter's recipient is the neighbour who lives at the parcel's house, so a letter is never handed over at the wrong door.
 * No letter-type parcel goes to Clementine's house, so her thread is told through letters she sends and letters about her.
 * Each placement is a real letter or signed parcel (checked in tests/letters-spring.test.ts). The final route carries none.
 * Swap slots: supper-1 / supper-1b (barnaby.pieBaker), fair-2 / fair-2b (bea.pudding), supper-5 / supper-5b (clementine.sundayNews).
 * An alternate rides the same placement as its default, so par and parcels never change. Letters that follow a swap slot accept either
 * version (an `any` requirement). carrots-1 and tunnel-4 stay single versions, easy to turn into swaps later.
 */
import type { Letter, LetterSlot } from "./types";

export const SPRING_LETTER_LIST: Letter[] = [
  // ---- fair: Bea has entered the Hollowmere Spring Fair under "A Mouse" and her pies are test bakes ----
  {
    id: "fair-1",
    sender: "Hollowmere Spring Fair",
    recipient: "bea",
    thread: "fair",
    envelope: "Hollowmere Spring Fair, stamped ACCEPTED. The entrant's name has been smudged by a very nervous thumb.",
    body: [
      "Dear Entrant,",
      "Your pie is accepted for the Hollowmere Spring Fair, entered as 'A Mouse (name withheld at her request)'.",
      "Rule 4: every pie must be tasted at home by an honest neighbour. Kind friends do not count. Mothers do not count.",
      "Keep the empty dishes as proof. We find they are the most honest feedback of all.",
      "Please don't worry. Everyone is nervous. Last year's winner fainted gently into a trifle.",
    ],
    placement: { route: "primrose", slot: 0 },
  },
  {
    // Swap slot (bea.pudding): this default fits "gentleman" and no reply; fair-2b is the "letter" version.
    id: "fair-2",
    sender: "Bea Thimblewick",
    recipient: "moles",
    thread: "fair",
    envelope: "From Bea on pink paper, smelling of scones. A tiny paw-print in the corner. Pudding signed too.",
    body: [
      "Dear Bert and Basil,",
      "Thank you for minding Pudding. I hope he didn't eat anything important.",
      "May I cool a test pie in your burrow? It is so lovely and cool down there.",
      "It's for something I'd rather not explain yet. Please don't tell anyone. It is a very small secret pie.",
    ],
    requires: { kind: "read", letter: "fair-1" },
    placement: { route: "hollow", slot: 1 },
  },
  {
    id: "fair-3",
    sender: "Hollowmere Spring Fair",
    recipient: "barnaby",
    thread: "fair",
    envelope: "Hollowmere Spring Fair again. A ribbon-and-wax envelope with a faint smell of lavender.",
    body: [
      "Dear Sir,",
      "We hear you are hosting a long table in Thistledown at the end of spring.",
      "The Hollowmere hall roof is being mended, so this year's pie judging will be held at your table.",
      "The judge is Mrs Marigold Fernsby, who will be in the village already.",
      "One entrant is a very nervous mouse. May we trust you to be kind, and also honest?",
    ],
    requires: { kind: "all", of: [{ kind: "any", of: [{ kind: "read", letter: "fair-2" }, { kind: "read", letter: "fair-2b" }] }, { kind: "read", letter: "carrots-1" }] },
    placement: { route: "sealed", slot: 0 },
  },

  // ---- tunnel: a small unexplained puddle is the tip of a tunnel network under every house ----
  {
    id: "tunnel-1",
    sender: "Mill Pond Committee",
    recipient: "moles",
    thread: "tunnel",
    envelope: "Mill Pond Committee, stamped 'Concerning a Small Puddle'. Slightly damp at one corner.",
    body: [
      "Dear Messrs Bert and Basil Mole,",
      "A small puddle has appeared underneath the pond.",
      "The Committee was not aware that a pond had an underneath.",
      "Would you kindly explain? Yours, in damp bewilderment.",
    ],
    placement: { route: "millpond", slot: 0 },
  },
  {
    id: "tunnel-2",
    sender: "Hollowmere Mole Guild",
    recipient: "moles",
    thread: "tunnel",
    envelope: "Hollowmere Mole Guild, very official. A folded map and a muddy thumbprint 'for scale'.",
    body: [
      "Dear Bert and Basil,",
      "Your tunnel survey has arrived, and the Guild is deeply impressed.",
      "Fourteen branches: one for every house in the village, each with its own hatch.",
      "Did you perhaps mean 'a burrow'? We enclose a map in case you have lost your way.",
    ],
    requires: { kind: "read", letter: "tunnel-1" },
    placement: { route: "footbridge", slot: 0 },
  },
  {
    // Could become a swap later (moles.puddle: help / quiet). For now one version.
    id: "tunnel-4",
    sender: "Bert and Basil Mole",
    recipient: "barnaby",
    thread: "tunnel",
    envelope: "Paw-printed note smelling of biscuits. 'Strictly confidential.' Bert has signed it twice.",
    body: [
      "Dear Barnaby,",
      "Yes. Our hatches (the Committee has signed for them) can hold your table steady, one under every leg.",
      "Basil says he is not sorry about the tunnels. Bert says he is a little sorry.",
      "P.S. Please tell Clementine her carrots were hanging over our tunnel all along. A plank is fitted; they'll surface by Sunday.",
    ],
    requires: { kind: "all", of: [{ kind: "read", letter: "tunnel-2" }, { kind: "read", letter: "supper-2" }, { kind: "read", letter: "carrots-1" }] },
    placement: { route: "pietin", slot: 0 },
  },

  // ---- supper: Barnaby is planning a surprise Spring Supper on one very long table ----
  {
    // Swap slot (barnaby.pieBaker): this default is the "To the Baker" version, for "secret" and no reply; supper-1b is the "told" version.
    id: "supper-1",
    sender: "Barnaby",
    recipient: "bea",
    thread: "supper",
    envelope: "Addressed only 'To the Baker, with thanks'. Pip tries very hard to look as if he doesn't know who that is.",
    body: [
      "Dear Baker,",
      "Whoever you are, thank you for the pies. The third one was slightly too sweet. That is my honest opinion.",
      "A question, purely hypothetical: how many pies could one baker manage for twelve?",
      "Please leave the dish on my step as usual. I shall return it very clean.",
    ],
    placement: { route: "willow", slot: 0 },
  },
  {
    id: "supper-2",
    sender: "Hollowmere Trestle & Tablecloth Co.",
    recipient: "barnaby",
    thread: "supper",
    envelope: "Hollowmere Trestle & Tablecloth Co. Stamped URGENT in cheerful red, with a tiny drawing of a chair.",
    body: [
      "Dear Mr Barnaby,",
      "Twelve chairs are confirmed, and one tablecloth of the usual length (very long).",
      "Delivery is for the last Sunday of spring, as requested.",
      "You asked us not to mention the occasion. We haven't. We have only drawn a chair on the envelope.",
    ],
    requires: { kind: "any", of: [{ kind: "read", letter: "supper-1" }, { kind: "read", letter: "supper-1b" }] },
    placement: { route: "latch", slot: 1 },
  },
  {
    // Swap slot (clementine.sundayNews): this default is the mystery invitation, for "keep" and no reply; supper-5b is the "tell" version. The slot delivers to the Moles
    // (no letter parcel goes to Clementine's house), so the invitation asks them to bring Clementine along.
    id: "supper-5",
    sender: "Barnaby",
    recipient: "moles",
    thread: "supper",
    envelope: "Cream card with gold-crayon edging, sealed twice. 'Tell no one' is written on the back, crossed out, then written again.",
    body: [
      "Dear Bert and Basil,",
      "You are invited, on the last Sunday of spring. Please come hungry.",
      "Do bring your hatches. Please bring Clementine too, and anyone she is hiding carrots from.",
      "I will say no more. It is a surprise, and I am very bad at those.",
    ],
    // Always the end of its own thread, so the full reveal is left to the Supper ending (#58).
    requires: { kind: "all", of: [{ kind: "read", letter: "tunnel-4" }, { kind: "read", letter: "supper-2" }] },
    placement: { route: "sealed", slot: 1 },
  },

  // ---- carrots: Clementine told her sister her carrots are lovely, and now her sister is coming to see them ----
  {
    // Could become a swap later (clementine.sisterNote: read / later). For now one version.
    id: "carrots-1",
    sender: "Marigold Fernsby",
    recipient: "barnaby",
    thread: "carrots",
    envelope: "Marigold's neat hand, thick envelope. 'Concerning my sister' is underlined twice.",
    body: [
      "Dear Mr Barnaby,",
      "My sister Clementine writes that you are the kindest squirrel on the lane, and that her carrots are 'coming up beautifully'.",
      "I shall come at the end of spring to admire them. Would you keep an eye out for me that Sunday?",
      "I do hope they are as beautiful as she says. She is usually so modest.",
    ],
    placement: { route: "hollow", slot: 0 },
  },
  {
    id: "carrots-3",
    sender: "Clementine Fernsby",
    recipient: "moles",
    thread: "carrots",
    envelope: "Clementine again, in neater writing. A pressed carrot-top is enclosed, with a very small flag.",
    body: [
      "Dear Bert and Basil,",
      "The plank is a marvel. A carrot has come up. A real one. I have cried a little.",
      "Marigold arrives on Sunday. Whatever you do, do not mention the tunnel under the carrots.",
      "If she asks, they have always been this way. Thank you, from my whole garden.",
    ],
    requires: { kind: "read", letter: "carrots-1" },
    placement: { route: "latch", slot: 0 },
  },

  // ---- door-reply alternates (#9): same slot as their default, shown when the player gave the other reply ----
  {
    id: "supper-1b",
    sender: "Barnaby",
    recipient: "bea",
    thread: "supper",
    envelope: "Barnaby's best handwriting, addressed to 'Miss Bea Thimblewick, Baker'. 'Miss' is underlined twice.",
    body: [
      "Dear Miss Thimblewick,",
      "Pip tells me the pies are yours. I am quite overcome. The dish will be returned very clean.",
      "The third pie was slightly too sweet. That is my honest opinion, and I hope you will forgive it.",
      "A question, purely hypothetical: how many pies could one baker manage for twelve?",
      "Do say if it is too much to ask. I shall wear my good waistcoat to hear the answer.",
    ],
    placement: { route: "willow", slot: 0 },
  },
  {
    id: "fair-2b",
    sender: "Bea Thimblewick",
    recipient: "moles",
    thread: "fair",
    envelope: "From Bea on pink paper, smelling of scones. A tiny paw-print in the corner, and one nibbled edge.",
    body: [
      "Dear Bert and Basil,",
      "I am so sorry. Pudding has eaten a letter, and I don't know whose. If yours went missing, it was him.",
      "Please forgive us both. I have enclosed a scone by way of apology.",
      "May I also cool a test pie in your burrow? It is so lovely and cool down there.",
      "It's for something I'd rather not explain yet. Please don't tell anyone. It is a very small secret pie.",
    ],
    requires: { kind: "read", letter: "fair-1" },
    placement: { route: "hollow", slot: 1 },
  },
  {
    id: "supper-5b",
    sender: "Barnaby",
    recipient: "moles",
    thread: "supper",
    envelope: "Cream card with gold-crayon edging. 'Tell no one' is crossed out and replaced with 'Clementine knows. Tell everyone.'",
    body: [
      "Dear Bert and Basil,",
      "It seems the whole lane knows already. Clementine had it from the rounds before I could finish the card.",
      "So: you are invited, on the last Sunday of spring. Please come hungry, and bring your hatches.",
      "Bring Clementine, of course. She says she knew all along, and that she has been very good about it.",
      "Anyone who is hiding carrots may bring them too. I am still very bad at surprises.",
    ],
    requires: { kind: "all", of: [{ kind: "read", letter: "tunnel-4" }, { kind: "read", letter: "supper-2" }] },
    placement: { route: "sealed", slot: 1 },
  },
];

/** The three door-reply swap slots (#9). The default letter also stands for "no reply yet" and any unknown reply. */
export const SPRING_SLOTS: LetterSlot[] = [
  { letter: "supper-1", flag: "barnaby.pieBaker", by: { secret: "supper-1", told: "supper-1b" } },
  { letter: "fair-2", flag: "bea.pudding", by: { gentleman: "fair-2", letter: "fair-2b" } },
  { letter: "supper-5", flag: "clementine.sundayNews", by: { keep: "supper-5", tell: "supper-5b" } },
];

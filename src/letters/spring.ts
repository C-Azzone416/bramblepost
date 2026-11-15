/**
 * The spring letter threads (#8), as data. The story notes and placement table are in docs/letters.md.
 *
 * Four threads, one default letter per slot (door-reply alternatives wait for #9):
 *   fair (Bea's test pies), tunnel (the Moles' network), supper (Barnaby's long table), carrots (Clementine's sister).
 * Every letter's recipient is the neighbour who lives at the parcel's house, so a letter is never handed over at the wrong door.
 * No letter-type parcel goes to Clementine's house, so her thread is told through letters she sends and letters about her.
 * Each placement is a real letter or signed parcel (checked in tests/letters-spring.test.ts). Route 15 carries none.
 * Slots #9 will give a door-reply alternative: supper-1 (barnaby.pieBaker), fair-2 (bea.pudding), supper-5 (clementine.sundayNews).
 * The others are single versions, easy to turn into swaps later.
 */
import type { Letter } from "./types";

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
    // Swap slot for #9 (bea.pudding: gentleman / letter). This default works with either reply.
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
    placement: { route: "hedgerow", slot: 1 },
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
    requires: { kind: "all", of: [{ kind: "read", letter: "fair-2" }, { kind: "read", letter: "carrots-1" }] },
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
    id: "tunnel-3",
    sender: "Mill Pond Committee",
    recipient: "moles",
    thread: "tunnel",
    envelope: "Mill Pond Committee, official. A wax seal and a blank line marked 'Witness', waiting for a squirrel.",
    body: [
      "Dear Bert and Basil,",
      "The Committee grants a conditional permit for 'small works' beneath the village.",
      "The permit needed a neighbour's signature. Mr Barnaby signed on his doorstep without reading past 'Dear Sir'.",
      "The Committee notes that 'small' is doing a great deal of work.",
    ],
    requires: { kind: "read", letter: "tunnel-2" },
    placement: { route: "hollow", slot: 1 },
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
    requires: { kind: "all", of: [{ kind: "read", letter: "tunnel-3" }, { kind: "read", letter: "supper-4" }, { kind: "read", letter: "carrots-2" }] },
    placement: { route: "kitten", slot: 0 },
  },

  // ---- supper: Barnaby is planning a surprise Spring Supper on one very long table ----
  {
    // Swap slot for #9 (barnaby.pieBaker: told / secret). This default is the "To the Baker" version, which needs no specific reply.
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
    requires: { kind: "read", letter: "supper-1" },
    placement: { route: "latch", slot: 1 },
  },
  {
    id: "supper-3",
    sender: "Hollowmere Trestle & Tablecloth Co.",
    recipient: "barnaby",
    thread: "supper",
    envelope: "Hollowmere Trestle & Tablecloth Co., second notice. One polite exclamation mark, then two more.",
    body: [
      "Dear Mr Barnaby,",
      "Your table is rather long. It will not fit on your lawn. We suggest the lane.",
      "We are told the cobbles are lumpy. A long table on lumpy cobbles will wobble.",
      "We cannot be held responsible for soup. Please advise.",
    ],
    requires: { kind: "read", letter: "supper-2" },
    placement: { route: "pietin", slot: 0 },
  },
  {
    id: "supper-4",
    sender: "Barnaby",
    recipient: "moles",
    thread: "supper",
    envelope: "Barnaby's best handwriting. 'Strictly confidential' is underlined, above a small drawing of a very long table.",
    body: [
      "Dear Bert and Basil,",
      "I have a long table, a lumpy lane and no idea what to do about the wobble. I am told you are good with the ground.",
      "Could you (hypothetically, and only if nobody asks) help my table to stand steady?",
      "I shall bring a pie. Someone keeps leaving pies on my step, and I have been eating them in the name of honesty.",
    ],
    requires: { kind: "read", letter: "supper-3" },
    placement: { route: "sealed", slot: 1 },
  },
  {
    // Swap slot for #9 (clementine.sundayNews: tell / keep). This default is the mystery invitation. The slot delivers to the Moles
    // (no letter parcel goes to Clementine's house), so the invitation asks them to bring Clementine along.
    id: "supper-5",
    sender: "Barnaby",
    recipient: "moles",
    thread: "supper",
    envelope: "Cream card with gold-crayon edging, sealed twice. 'Tell no one' is written on the back, crossed out, then written again.",
    body: [
      "Dear Bert and Basil,",
      "You are invited to a Spring Supper on the last Sunday of spring, at a long table down the lane. Please come hungry.",
      "Do bring your hatches. Please bring Clementine too, and anyone she is hiding carrots from.",
      "I will say no more. It is a surprise, and I am very bad at those.",
    ],
    requires: { kind: "read", letter: "tunnel-4" },
    placement: { route: "dovecote", slot: 1 },
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
    id: "carrots-2",
    sender: "Clementine Fernsby",
    recipient: "moles",
    thread: "carrots",
    envelope: "Clementine's best stationery, hastily blotted. The word 'discretion' appears three times on the front.",
    body: [
      "Dear Bert and Basil,",
      "May I have a quiet word about the soil under my carrot bed? After dark, please, and with great discretion.",
      "It is not a puddle. It is only that something is not quite right with the carrots.",
      "My sister is coming at the end of spring, and I may have been a little cheerful in my letters.",
    ],
    requires: { kind: "read", letter: "carrots-1" },
    placement: { route: "latch", slot: 0 },
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
    requires: { kind: "read", letter: "carrots-2" },
    placement: { route: "kitten", slot: 1 },
  },
];

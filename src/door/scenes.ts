/**
 * Spring door scenes: who Pip stays for tea with after each route, what they say, the two replies
 * and the stamp. Text only; the voice is gibberish blips (see voice.ts).
 * Keep each line short enough to read at a glance on a phone (tests cap it at 140 characters).
 */
import type { DoorScene } from "./story";

export const SPRING_SCENES: DoorScene[] = [
  {
    route: "primrose",
    host: "tea",
    speaker: "Clementine Fernsby",
    voice: 520,
    lines: [
      "Seeds from my sister in Hollowmere! Carrots, by the look of it. She thinks my carrots are tragic.",
      "She always tucks a note in. Would you read it to me, dear? These spectacles are mostly for show.",
    ],
    choices: [
      {
        id: "read",
        label: "Read it aloud",
        reply: "“Plant them deeper this year, Clem.” Hmph! Pour yourself another cup, Pip. I'll be writing back.",
      },
      {
        id: "later",
        label: "Save it for later",
        reply: "Quite right. Some notes need a fresh pot first. I'll prop it up by the kettle.",
      },
    ],
    flag: "clementine.sisterNote",
    stamp: { name: "Primrose", value: 1, motif: "primrose", sky: "#f6e7a8" },
  },
  {
    route: "clover",
    host: "acorn",
    speaker: "Old Barnaby",
    voice: 190,
    lines: [
      [
        { if: { coldPie: true }, say: "A pie! Gone a touch cold, but a pie is a pie. Who on earth sends an old fellow a pie?" },
        { say: "A pie! Still warm, too. Who on earth sends an old fellow a pie?" },
      ],
      "No name on the label again. That's the third one this spring. Do you know who's baking these, Pip?",
    ],
    choices: [
      {
        id: "told",
        label: "Tell him who baked it",
        reply: "Bea Thimblewick? Well, I never. I'll have to return the dish in person. In my good waistcoat.",
      },
      {
        id: "secret",
        label: "Keep the baker's secret",
        reply: "A mystery pie. Even better! I'll leave the dish on the step and see who comes for it.",
      },
    ],
    flag: "barnaby.pieBaker",
    stamp: { name: "Four-leaf Clover", value: 2, motif: "clover", sky: "#cfe6b4" },
  },
  {
    route: "millpond",
    host: "burrow",
    speaker: "The Mole Bros.",
    voice: 300,
    lines: [
      "Post! For us? Nobody writes to us. Bert, put the kettle on. No, the other kettle.",
      "It's from the Mill Pond committee. A small, unexplained puddle has appeared. Underneath the pond.",
      "We have no idea how that happened. None at all. Biscuit?",
    ],
    choices: [
      {
        id: "help",
        label: "Offer to help fill the tunnel",
        reply: "What tunnel? ...Fine. Bring a bucket on Thursday. And don't tell Barnaby, he'll want a tour.",
      },
      {
        id: "quiet",
        label: "Promise not to mention it",
        reply: "A postie who keeps a secret! Bert, give him the good biscuit. The one without the soil.",
      },
    ],
    flag: "moles.puddle",
    stamp: { name: "Mill Wheel", value: 2, motif: "wheel", sky: "#bfe0e4" },
  },
  {
    route: "footbridge",
    host: "mush",
    speaker: "Bea Thimblewick",
    voice: 610,
    lines: [
      "Pudding! My darling! Did Pip carry you all the way over the footbridge?",
      "He's been staying with the Moles all week. They say he was very well behaved. They said it rather quickly.",
      "Was he good on the way, Pip? Honestly?",
    ],
    choices: [
      {
        id: "gentleman",
        label: "He was a perfect gentleman",
        reply: "I knew it. Pudding, you angel. Have a scone, Pip, and don't mind the hissing.",
      },
      {
        id: "letter",
        label: "He ate a letter",
        reply: "Oh, Pudding. Whose? No, don't tell me. I'll write to everyone and apologise, just in case.",
      },
    ],
    flag: "bea.pudding",
    stamp: { name: "Footbridge", value: 3, motif: "bridge", sky: "#d7eaf2" },
  },
  {
    route: "hollow",
    host: "tea",
    speaker: "Clementine Fernsby",
    voice: 520,
    lines: [
      [
        { if: { coldPie: true }, say: "Sunday pie! A little cool, but that's what custard is for. Sit, sit." },
        { say: "Sunday pie, and still warm! Sit, sit. Sunday tea is the best tea." },
      ],
      [
        {
          if: { flag: "clementine.sisterNote", is: "read" },
          say: "I wrote back to my sister. Told her my carrots are coming up beautifully. They are not.",
        },
        {
          if: { flag: "clementine.sisterNote", is: "later" },
          say: "I finally read my sister's note. Plant them deeper, she says. I planted them shallower, out of principle.",
        },
        { say: "My sister says my carrots are tragic. She hasn't seen this year's. Neither have I. They're very shy." },
      ],
      [
        {
          if: { flag: "barnaby.pieBaker", is: "told" },
          say: "And Barnaby went by this morning in his good waistcoat, carrying a pie dish. Toward the Mushroom House!",
        },
        {
          if: { flag: "barnaby.pieBaker", is: "secret" },
          say: "And someone keeps leaving pies on Barnaby's step. The whole lane is talking about it.",
        },
        { say: "And the whole lane is buzzing about something this week. Nobody will tell me what." },
      ],
      "You hear everything on your rounds, Pip. Do you know anything about it?",
    ],
    choices: [
      {
        id: "tell",
        label: "Share the lane's news",
        reply: "I knew it! Oh, this needs more cake. You're the best postie Thistledown has ever had.",
      },
      {
        id: "keep",
        label: "Say a postie never tells",
        reply: "Hmph. Loyal to the satchel. Fine, have the biggest slice anyway.",
      },
    ],
    flag: "clementine.sundayNews",
    stamp: { name: "Sunday Tea", value: 5, motif: "teapot", sky: "#f3d4a4" },
  },
];

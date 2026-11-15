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
  {
    route: "willow",
    host: "acorn",
    speaker: "Old Barnaby",
    voice: 190,
    lines: [
      [
        { if: { coldPie: true }, say: "Another pie! A touch cool, but I've learned to eat them at any temperature. Still no name on it." },
        { say: "Another pie, and warm! The mystery baker is getting quicker. Still no name on it, mind." },
      ],
      "I walked the Willow Walk this morning, hoping to catch them. It loops round, you know. I ended up back at my own gate.",
      "Do you think I ought to leave a thank-you on the step, Pip?",
    ],
    choices: [
      {
        id: "note",
        label: "Leave a thank-you note",
        reply: "A note! Yes. Short, with a drawing of an acorn. I'm much better at acorns than at words.",
      },
      {
        id: "dish",
        label: "Leave the empty dish",
        reply: "An empty dish says it all. Quite right. Mind the step on your way out, it's slippery.",
      },
    ],
    flag: "barnaby.willowThanks",
    stamp: { name: "Willow Walk", value: 3, motif: "willow", sky: "#dcebc0" },
  },
  {
    route: "brook",
    host: "burrow",
    speaker: "The Mole Bros.",
    voice: 300,
    lines: [
      "A pie! For us! Bert, put the kettle on. The good kettle, this time.",
      "We'd have met you at the door, but the brook came up over the tunnel again. Entirely unrelated to anything.",
      "We checked the pie. Bert checked it twice. It was a very thorough check. Slice?",
    ],
    choices: [
      {
        id: "share",
        label: "Stay for a slice",
        reply: "Splendid! Bert, the good plates. No, the other good plates. The ones that match.",
      },
      {
        id: "pocket",
        label: "Take a slice for the road",
        reply: "A postie on the move! Wrapped in a leaf, still warm. Mind the brook, it's higher than it looks.",
      },
    ],
    flag: "moles.brookPie",
    stamp: { name: "Brookside", value: 4, motif: "brook", sky: "#cfe7ec" },
  },
  {
    route: "bridgeway",
    host: "mush",
    speaker: "Bea Thimblewick",
    voice: 610,
    lines: [
      [
        { if: { coldPie: true }, say: "Oh, Pudding! You've come all the way over the bridge. The pies are a little cool, but nobody minds." },
        { say: "Oh, Pudding! You've come all the way over the bridge, and the pies are still warm." },
      ],
      "Barnaby and Clementine both had a pie today, I hear. Half the lane smells of pastry. It's a good week for it.",
      "Pudding sat on the footbridge all morning, watching for you. Shall I tell you what he did when he saw the satchel?",
    ],
    choices: [
      {
        id: "tell",
        label: "Ask her to tell you",
        reply: "He purred so loudly the whole bridge hummed. I don't think he'd ever admit it. Have a scone, Pip.",
      },
      {
        id: "guess",
        label: "Guess he looked unbothered",
        reply: "Ha! Exactly right. Very dignified, tail high. Then he fell off the rail. Don't tell him I told you.",
      },
    ],
    flag: "bea.bridgeway",
    stamp: { name: "Lantern Bridge", value: 4, motif: "lantern", sky: "#f1dca8" },
  },
  {
    route: "latch",
    host: "acorn",
    speaker: "Old Barnaby",
    voice: 190,
    lines: [
      "A signed letter, and for me! Nobody sends me a signed letter. They send me pies, mostly.",
      "I do wish they'd put the latch on the other side of the gate. I've been opening it from the wrong end for years.",
      "Come in, Pip, come in. The kettle's on. Shall I read it to you, or shall we leave it a while?",
    ],
    choices: [
      {
        id: "read",
        label: "Ask him to read it aloud",
        reply: "Quite right. “Dear Barnaby, the gate hinge wants oiling.” Well! I could have told them that myself.",
      },
      {
        id: "wait",
        label: "Let it keep a while",
        reply: "Wise postie. A letter is better when you know it's there. I'll prop it by the clock.",
      },
    ],
    flag: "barnaby.latchLetter",
    stamp: { name: "Garden Gate", value: 4, motif: "gate", sky: "#e2e8c0" },
  },
  {
    route: "hedgerow",
    host: "tea",
    speaker: "Clementine Fernsby",
    voice: 520,
    lines: [
      [
        { if: { coldPie: true }, say: "Pie! A bit cold, but the hedgerow is lovely this time of year, so I forgive everyone." },
        { say: "Pie, and still warm! The hedgerow is lovely this time of year, so everyone is forgiven in advance." },
      ],
      "I counted the berries on the way in. Forty-one. Then I counted again and got forty-three. It must be growing.",
      "Sit down, Pip. Tea? Or would you rather see how the carrots are getting on? They're being shy.",
    ],
    choices: [
      {
        id: "tea",
        label: "Tea, please",
        reply: "Tea it is. Milk first, as it should be. Mind the cat hair, there's rather a lot about this week.",
      },
      {
        id: "carrots",
        label: "Go and see the carrots",
        reply: "Oh, would you? They're by the back fence. Speak softly, they startle. I'll bring the tea out.",
      },
    ],
    flag: "clementine.hedgerow",
    stamp: { name: "Hedgerow", value: 5, motif: "hedge", sky: "#d8e8bf" },
  },
  {
    route: "pietin",
    host: "tea",
    speaker: "Clementine Fernsby",
    voice: 520,
    lines: [
      [
        { if: { coldPie: true }, say: "Is that my pie? It's gone a bit cool crossing the stream. Never mind, I own a very good oven." },
        { say: "My pie, still warm! You carried it over that wobbly footbridge without a single crumb lost." },
      ],
      "It's the tin I want back, really. It was my mother's. It has a dent shaped exactly like Thistledown.",
    ],
    choices: [
      {
        id: "dent",
        label: "Admire the dent",
        reply: "It does look like Thistledown, doesn't it? Right there, the pond. I'll never bake in another tin.",
      },
      {
        id: "return",
        label: "Offer to bring it back later",
        reply: "Would you? Wrapped in the green cloth, please. A pie tin deserves a proper homecoming.",
      },
    ],
    flag: "clementine.pieTin",
    stamp: { name: "Pie Tin", value: 6, motif: "pietin", sky: "#f1d9a9" },
  },
  {
    route: "sealed",
    host: "burrow",
    speaker: "The Mole Bros.",
    voice: 300,
    lines: [
      "A sealed letter! Bert, someone has written to us, and put wax on it. Fancy wax.",
      "It says to wait until Old Barnaby has had his post. He has? Good. Then it's allowed. Open it, Bert.",
      "...It's an invitation. To a tunnel. Somebody knows about the tunnel, Bert.",
    ],
    choices: [
      {
        id: "keep",
        label: "Keep the seal for them",
        reply: "A postie who saves the wax! Bert, put it by the good biscuits. We shall say nothing, and neither shall you.",
      },
      {
        id: "tell",
        label: "Say Barnaby already knows",
        reply: "He KNOWS? That squirrel. Fine. We'll give him a proper tour. A short one. Mind the puddle.",
      },
    ],
    flag: "moles.seal",
    stamp: { name: "Wax Seal", value: 7, motif: "seal", sky: "#ecc9c3" },
  },
  {
    route: "kitten",
    host: "mush",
    speaker: "Bea Thimblewick",
    voice: 610,
    lines: [
      "Pudding! And who is this? Oh, Pip. Pudding has been telling everyone he's very important and very brave.",
      [
        {
          if: { flag: "bea.pudding", is: "letter" },
          say: "I wrote to everyone about the letter he ate. Barnaby wrote back. He says it was probably an improvement.",
        },
        { say: "He sat on the post office sill all morning, supervising. I think he believes he is the postmaster." },
      ],
      "Would you let him ride in the satchel again next week? He insists. He has already packed a mouse toy.",
    ],
    choices: [
      {
        id: "yes",
        label: "Say he can ride along",
        reply: "Oh, he'll be unbearable. Pudding, you've been hired. Have a scone, Pip. Take two.",
      },
      {
        id: "last",
        label: "Say the cat rides last",
        reply: "Last? Pudding won't like that. But he'll take it better from a postie. Rules are rules.",
      },
    ],
    flag: "bea.kitten",
    stamp: { name: "Kitten", value: 8, motif: "kitten", sky: "#e4d6ec" },
  },
];

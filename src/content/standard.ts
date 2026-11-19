/** The standard pack: today's spring content, built in code from the shipped modules. Nothing is read from disk. */
import { ENDING_SCENES } from "../door/ending";
import { SPRING_SCENES } from "../door/scenes";
import { SPRING_LETTER_LIST, SPRING_SLOTS } from "../letters/spring";
import { endingToPack } from "./ending";
import type { ContentPack } from "./types";

export const STANDARD_PACK: ContentPack = {
  version: 1,
  mode: "standard",
  season: "spring",
  scenes: SPRING_SCENES,
  letters: SPRING_LETTER_LIST,
  slots: SPRING_SLOTS,
  seasons: Object.fromEntries(["summer", "autumn", "winter"].map((season) => [season, { village: ({ summer: "hollowmere", autumn: "conker", winter: "snowberry" } as Record<string, string>)[season], intro: Array.from({ length: 5 }, (_, i) => `[stand-in] ${season} intro line ${i + 1}`), routes: [], houses: [], ending: { route: "", kicker: [{ say: `[stand-in] ${season} kicker` }], title: [{ say: `[stand-in] ${season} title` }], envelope: [{ say: `[stand-in] ${season} envelope` }], lines: [`[stand-in] ${season} ending line`] }, scenes: [], letters: [], slots: [], placeholder: { scene: `Placeholder: ${season} door scene`, letter: `Placeholder: ${season} letter` } }])),
  ending: endingToPack(ENDING_SCENES[0]),
};

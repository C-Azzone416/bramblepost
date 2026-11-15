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
  ending: endingToPack(ENDING_SCENES[0]),
};

# Design

## Ending

**Decision (#26, 2026-11-15): option A, a new village per season.** When lane 15 (`lastround`, the last Thistledown lane) is stamped, the closing scene plays after its door scene and letters. The target is Old Barnaby's surprise **Spring Supper** on the long table (#58, after Caroline signs off the letters in #8). Later seasons open a **new village** (Hollowmere next) rather than extending this path.

**Fallback (the user's choice, an assumption Caroline can overturn):** until the Supper exists, the ending is a short **thank-you letter to Pip** signed by Clementine, Old Barnaby, Bea Thimblewick and the Mole Bros. It invents no neighbour secrets.

How it works:
- The scene is data in `src/door/ending.ts`; `#58` swaps the entry without code changes. The hook is `withEnding` (`src/door/endingView.ts`), composed around the letters and door hooks in `src/main.ts`, cancellable like them.
- It plays once. "Seen" is saved (`bramblepost-ending-v1`) only when read through, so leaving mid-ending plays it again next time. Replaying any route never replays it. Reset clears it.
- Once seen, the map shows the whole path stamped and a note, "Spring is done. Hollowmere next", by Hollowmere's fog. Hollowmere stays locked; the note is its own element (`vnextnote`) so it can later become the way into the next village.

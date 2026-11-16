# Spoiler warning

`story-pack.b64` in this folder holds the encoded story (gzip + base64). Don't open, decode, print or paste it, and don't
run anything that does. Treat it as spoilers for everyone who hasn't played it.

How it is used: only `npm run play` reads it (story mode, in Node at dev-server time). `npm run dev`, `npm test`,
`vite build` and CI use the standard or stand-in content and never read it. Set `BRAMBLEPOST_STORY_PACK` to point
story mode at another file.

`npm run leak-check` checks that nothing from it ends up in git or in a built `dist`. It prints counts and file
names only.

The rule lives in `docs/story-secrecy.md`.

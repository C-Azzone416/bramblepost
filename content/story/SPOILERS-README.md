# Spoiler warning

`story-pack.b64` in this folder holds the encoded story (gzip + base64). Don't open, decode, print or paste it, and don't
run anything that does. Treat it as spoilers for everyone who hasn't played it.

How it is used: story mode (`npm run play`) reads it in Node at dev-server time. Preview builds, `npm run dev`,
`npm test` and CI builds use the standard or stand-in content. Set `BRAMBLEPOST_STORY_PACK` to point story mode at
another file.

The separate leak checker (`npm run leak-check`, locally and in CI) does read and decode the pack in memory, to look for
its text in tracked files and in built output. It prints counts and file names only, never text. It can miss very
short strings and text that was changed when it was built.

The rule lives in `docs/story-secrecy.md`.

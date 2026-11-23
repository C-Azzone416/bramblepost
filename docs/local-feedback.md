# Local screenshot feedback preview

Stop any existing server on port 8080 before starting (do not stop someone else's server). Run:

```sh
npm run feedback:local
```

Open **http://localhost:8080** on the same computer. Take a screenshot of only the game using your normal screenshot tool, then choose **Feedback**, select the PNG, review it, and enter optional notes. **Run local check** prepares a report. **Download local report (JSON)** explicitly saves the notes and screenshot size/hash to your downloads. **Download screenshot (PNG)** explicitly saves a copy of the reviewed image. The JSON does not embed the PNG. No network delivery, diagnostics, enrollment or automatic screenshot capture is enabled.

To test the real Framebriar offline report preparation, point at your already-authorized official checkout:

```sh
BRAMBLEPOST_FRAMEBRIAR_SDK_ROOT=/path/to/official/framebriar npm run feedback:local
```

Offline SDK preparation and the synthetic lifecycle were tested against official Framebriar revision `d133c864eacaa70bf896a370c4cccad5cc777725`. Without the SDK, this runs a labeled local check only. Don't set the path to unreviewed code. Use only the dedicated local server: no forwarding or public hosts. This mode forces placeholder content and is never active in normal dev or production. Live Framebriar delivery is not wired up. It still needs enrollment enabled for the staged route, a cleared service safety latch, a scoped invitation, and a reviewed outbox with independently verified receipts.

A staged Bramblepost route exists with enrollment and telemetry disabled. No live account, report queue or sender is created by this preview. If live delivery is later enabled, send previously saved reports manually only after reviewing them again.

To check the SDK access/outbox contract without live service or persistent browser data:

```sh
BRAMBLEPOST_FRAMEBRIAR_SDK_ROOT=/path/to/official/framebriar node tools/check-local-feedback-sdk.mjs
```

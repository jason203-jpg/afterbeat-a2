# Afterbeat

README prose word count: 414

Afterbeat is a mobile-first prototype for comparing two ways of rejecting a music recommendation. The fictional catalogue and synthesised clips make it possible to replay both versions from the same starting state.

## Status and stack

- Implemented: preview, skip, session-only hiding, persistent down-ranking, immediate undo, a visible queue, feedback history and demo reset.
- Simulated: six fictional tracks and their base relevance scores. A deterministic JavaScript ranker subtracts 28 points from a saved track; the track remains eligible. No trained model, backend, external service or API key is used.
- Future work: a real catalogue and learned ranker, and a study of comprehension, perceived control and interaction effort.
- The interface uses HTML and CSS with browser JavaScript. Web Audio synthesises the clips. Local storage holds only the down-ranked track IDs for each version. If storage is blocked, feedback lasts until the page closes or reloads.

## Run and replay

Open `index.html` in a modern browser. For consistent persistence, serve the folder locally and open [http://localhost:8000](http://localhost:8000).

```sh
python -m http.server 8000
```

Select **Reset demo** before each example. Start in **Two choices** for the first two.

1. On **Glass Hour**, select **Feedback → Not now**. Paper Moon replaces it. **New session** brings Glass Hour back.
2. Select **Feedback → Recommend less** on Glass Hour. Start a new session. Paper Moon leads and Glass Hour appears at the bottom of **Up next** with a Down-ranked label.
3. In **Single dislike**, select **Dislike** on Glass Hour. Paper Moon replaces it and the confirmation explains the future effect. **Undo** restores Glass Hour and clears that decision.

Run the state checks with Node.js 18 or later. The demo itself needs only the browser.

```sh
node --test engine.test.js
```

To repeat the scripted browser checks, install Playwright and its Chromium browser for this folder.

```sh
npm install --no-save playwright
npx playwright install chromium
node browser-check.cjs
```

## Development record

- [162999b](https://github.com/jason203-jpg/afterbeat-a2/commit/162999b) Modelled session hides and saved track penalties independently. The state checks cover expiry, rank, undo, skip, exhausted catalogues and stored data.
- [12838d6](https://github.com/jason203-jpg/afterbeat-a2/commit/12838d6) Connected a shared player to both versions and added feedback beside the player. Browser replay checked the three scenarios, reload persistence, mode isolation, cancellation, blocked storage and narrow layouts.
- The companion A2 report contains screenshots and the system diagram.

## AI assistance

OpenAI Codex drafted the prototype, tests, screenshots, report and documentation from the A1 research question. Development checks used executable state assertions and browser replay. The replay checked that both forms of persistent feedback had the same ranking effect and that a session hide expired. A1 supplied the research framing and literature; the demo code and artwork were generated during A2. No AI service is called during use.

# Afterbeat

README prose word count: 530

Afterbeat is a mobile-first prototype for comparing the duration of negative feedback. **Two choices** and **Single dislike** are the original A1 comparison. **Track or style** separately explores whether the same feedback should affect one song or a style.

## Status and stack

- Implemented: music previews, skip, session-only hiding, persistent track and style feedback, immediate undo, a visible queue, feedback history and demo reset.
- Simulated: six fictional tracks and their base relevance scores. A deterministic JavaScript ranker subtracts 28 points once when a track or its style matches saved feedback. The track remains eligible.
- Future work: a real catalogue and learned ranker, and a study of comprehension, perceived control and interaction effort.
- The interface uses HTML, CSS and JavaScript. Web Audio plays six original arrangements of roughly 8–11 seconds: two Ambient, two Synth pop and two Chillhop. The catalogue and previews are shared by all modes. Browser storage keeps track IDs and style names by mode. If storage is blocked, feedback lasts until the page closes or reloads.

## Run and replay

Open `index.html` in a modern browser. For consistent persistence, serve the folder locally and open [http://localhost:8000](http://localhost:8000).

```sh
python -m http.server 8000
```

Select **Reset demo** before each example. Start in **Two choices** for the first two.

1. On **Glass Hour**, select **Feedback → Not now**. Paper Moon replaces it. **New session** brings Glass Hour back.
2. Select **Feedback → Recommend less** on Glass Hour. Start a new session. Paper Moon leads and Glass Hour appears at the bottom of **Up next** with a Down-ranked label.
3. In **Single dislike**, select **Dislike** on Glass Hour. Paper Moon replaces it and the confirmation explains the future effect. **Undo** restores Glass Hour and clears that decision.
4. In **Track or style**, use **Feedback → Recommend less of this track**. After **New session**, Glass Hour is at the bottom and Low Tide stays near the top. Reset and repeat with **Recommend less of this style**. Both Ambient tracks move to the bottom.

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
- [b199e3f](https://github.com/jason203-jpg/afterbeat-a2/commit/b199e3f) Made browser replay wait for the current track's confirmation and checked that both A1 versions give persistent feedback the same ranking effect.
- [692231c](https://github.com/jason203-jpg/afterbeat-a2/commit/692231c) Added distinct music previews and a separate style mode. Replay checked the different outcomes for Glass Hour and Low Tide, browser storage and playback.
- The A2 Project Report PDF is the Canvas deliverable. Its system diagram and three storyboards can be read alongside the replay steps above.

## AI assistance

Codex helped build the prototype and music synthesis and assisted with tests, screenshots, the report and this README. I checked all six audio previews, ran the eight state tests, and replayed the feedback flows in Chrome. One replay check was corrected to wait for the confirmation for the current track. The runtime uses a local ranking rule.

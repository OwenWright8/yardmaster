# Yardmaster — the shunting puzzle

A cosy, touch-first puzzle game about the classic **Inglenook sidings**: three dead-end sidings fanning out from one
set of points, a short headshunt, a little shunter and a handful of wagons. Make up the target train, in order, on
siding A — in as few moves as you can.

## How to play
- **Tap a siding** to drive the loco in. It pushes the wagons it's pulling in, and couples to everything there.
- **Choose what to pull out**: tap a wagon (it comes out with everything between it and the loco) or use the
  *Take 1 / 2 / 3* buttons.
- The headshunt only has room for a few wagons, and the sidings only hold so many. That's the whole puzzle.
- Get the wagons shown at the top onto **siding A**, in that order from the buffers. The dashed ghosts show where
  each one goes, and wagons already in place glow green.

## What's in it
- **60 campaign puzzles** in five yards, from *First Steps* to *Yardmaster*. Every puzzle's **par** (the fewest
  moves possible) comes from a solver, and sets your stars: three for par.
- **Stars open new yards**; finishing a yard opens its chest.
- **Daily puzzle** with a streak bonus, and **Rush**: three minutes, as many yards as you can sort.
- **Coins** for first clears, three stars, perfect runs (no undo, no hints), the daily and Rush; spend them on
  **loco liveries** and **yard themes**, or on **hints** (the solver's best next move).
- Free undo, restart, sound and haptics.

## Running it
```bash
npm install
npm run dev        # play at http://localhost:5173 (on your phone too: use the Network address)
npm test           # puzzle rules, solver and level checks
npm run build      # production build in dist/
npm run levels     # regenerate the campaign puzzles (src/levels.json)
```
Pushing to `main` publishes the game to GitHub Pages (Settings → Pages → branch `gh-pages`). On an iPhone, open the
page in Safari and choose **Share → Add to Home Screen**: it runs full screen and works offline.

## Building the iOS app (on a Mac)
The project is set up for [Capacitor](https://capacitorjs.com):
```bash
npm install
npm run build
npx cap add ios          # first time only: creates the ios/ Xcode project
npm run ios              # build, copy into the app, and open Xcode
```
In Xcode, pick your team under *Signing & Capabilities*, choose a device or simulator and press Run. For the App
Store: *Product → Archive*, then upload from the Organizer. App icons are in `public/icon-1024.png` and friends.

## How it's made
- `src/puzzle.ts`: the rules, and a breadth-first solver (wagons outside the target are treated as identical,
  which keeps it fast).
- `src/chapters.ts`, `scripts/gen-levels.ts`: the campaign and its difficulty ramp; levels are generated ahead
  of time so each one's par is exact.
- `src/render.ts`, `src/art.ts`: the yard and the rolling stock, drawn from above (the wagon art comes from the
  Branch Line game).
- `src/main.ts`: screens, animation, rewards. The solver runs in a Web Worker for hints and the daily puzzle.

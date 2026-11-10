# epoch-web

The official site for Epoch (Project Epoch), the iPhone-first real-time strategy game in
[`couson-ai/epoch-rts`](https://github.com/couson-ai/epoch-rts).

It is a static page with no build step and no dependencies: `index.html`, `styles.css`, `main.js`,
`table.js` and the images in `assets/`. Fonts load from Google Fonts and fall back to system faces offline.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

## How it is put together

- **The stage.** The first part of the page is one pinned viewport driven by scroll. Every element
  with `data-beat` is a beat of text; `data-len` is how many viewports of scroll it lasts.
  Consecutive beats with the same `data-bg` share a backdrop, and a change of backdrop is painted
  on a canvas as a dithered wipe (`data-wipe`: `column`, `radial`, `sweep`, `rise`, `fall`, `tide`,
  `noise`). To add, remove or reorder scenes, edit the markup; `main.js` reads the timeline from it.
- **Backdrops.** Picture backdrops are listed in `PICTURES` in `main.js` (focus point, slow zoom,
  text scrim). `sky`, `paper` and `ink` are painted surfaces.
- **The rules.** `--gy` and `--gx` on a beat place the moving horizontal and vertical hairlines and
  the two star markers; the headline sits above the horizontal rule and the paragraph below it.
- **The match.** The four "You explore / build / command / finish it" beats share one canvas, drawn
  by `table.js`: an illustrated match on a paper map (fog of war as a halftone screen, buildings
  placed by hold-drag-release, armies ordered by their banners, a battle and a siege). Each phase
  is a short loop scripted in `SCRIPT`; every frame is a pure function of phase and time, so
  `EpochTable.at('finish', 5.6)` in the console poses any moment for checking. It is a drawing of
  the game's rules, not captured footage, and the caption under it says so. Swap in real footage
  when there is some.
- **Taking over.** "Take command" on the plate (or a mouse press on the map) swaps the film for a
  live skirmish on the same map, also in `table.js`: four armies you order by holding a banner,
  dragging and releasing; dragging open ground moves the map. Armies are simulated whole, cross the
  river only at the ford, defend themselves when idle and heal on friendly ground. The enemy holds
  its capital, then comes for the village. The objectives beside the map tick off as you go, and
  the game ends when a capital falls or your armies are gone. "Back to the demo", Escape, or
  scrolling past the section returns to the film. Unit numbers live in `STATS` and are tuned for a
  one-to-two-minute match, not copied from the game's balance.
- **Below the stage** the ledger, the questions and the footer are ordinary scrolling sections.

## Images

All artwork comes from `epoch-rts/Docs/Art`, converted to WebP.

| File | Source | Kind |
| --- | --- | --- |
| `archipelago.webp` | `NavalConcepts/2026-10-16/TidalArchipelago-Map.png` | concept art |
| `economy.webp` | `GameplayExamples/2026-10-15/02-economy-in-world.png` | concept art (blurred, behind the questions) |
| `naval.webp` | `NavalConcepts/2026-10-16/NavalBattle-Concept.png` | concept art |
| `civ-*.webp` | `Buildings/2026-10-16/*-TownCenter.png` | in-engine renders, background removed |

The page labels concept art as concept art. Keep that if the pictures change.

## Before publishing

- Every "Request access" button, and the address in the footer, opens an email to
  `couson@foxmail.com` with the subject "Epoch beta access". To change the address or move to a
  sign-up form, replace the `mailto:` links in `index.html` (there are five).
- Copy is drawn from the game's README and design docs as of November 2026; check the numbers in
  the ledger against the current build.

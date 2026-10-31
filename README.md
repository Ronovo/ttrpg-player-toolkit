# TTRPG Player Toolkit

A browser table for tabletop players: dice, playing card and tarot decks, a notepad and a Jenga tower. It is a
static React site with no server code; everything it keeps is saved in your browser.

## Features

Each tool has its own tab. **Home**, the first tab, has them all on one screen: a quick dice roller and the
notepad side by side, with the card drawer below. On a desktop it fits the window until a deck is built.

- **Dice Roller:** roll 1 to 10 of a d4, d6, d8, d10, d12, d20 or d100. **Animate** throws them in 3D, in one of
  51 dice sets (Base, Basic, Premium and Weird). Every set has its own finish, ink and number font. A category
  shows nine sets at a time, and arrows turn to its next page. Star a set to
  add it to **Favorites**, an extra category that shows once anything is starred. On Home the dice fly across the
  window, with a large preview of the chosen set; on the Dice Roller tab they land on a **roll mat** with a felt, velvet, leather, wood or stone
  surface in any color, or your own picture, and an optional wood or leather rim. Turn on **Tower** to stand a
  dice tower on the mat: the dice drop in through a hole in its top or side and roll out of its door. There are
  ten, from a lighthouse and a windmill to a rocket and a haunted tree.
- **Card Drawer:** build a stack from any number of playing card decks (with or without jokers) or tarot decks.
  Draw, shuffle, discard and shuffle the discard back in, and add another deck at any time. Tarot cards come up
  reversed half the time, and the Major and Minor Arcana can be split into two piles. Each pile shows its deck
  face down; click it to draw. The card backs follow the page style, or use a picture you upload.
- **Notepad:** session notes.
- **Jenga:** a tower you pull blocks from. Each pull makes it more likely to fall, at Less Tense, Normal or More
  Tense, and it shows how it is holding up: Solid, Wobbly, Teetering or Doomed.
- Ten styles for the page, each with its own heading font and backdrop: Tabletop, Parchment, Polished Dark,
  Casino, Eldritch, Neon, Dossier, Slasher, Field Kit and Forest.

The notes, the Jenga tower, the style, the dice set, the favorites, the roll mat, the tower and the card back are
kept in the browser's `localStorage`, so they are separate for each browser and each address the site is served
from.

## Running

Uses Node 24, the version the `Dockerfile` builds with.

```sh
npm install
npm run dev       # http://localhost:5173 with live reload
npm run build     # writes the site to dist/
npm run preview   # serves dist/
npm test          # the Vitest tests in tests/
npm run coverage  # the same, with an HTML report in coverage/js that fails below 100%
```

The Docker image also builds the coverage report and serves it at `/coverage/`, under the landing page in
`coverage-index/`, the `ronovos-coverage-index` submodule, with this repo's `coverage-reports.json`. Failing tests
or low coverage don't stop the image build; the report shows what is missing.

### Docker

The `Dockerfile` builds the site and serves `dist/` with an unprivileged nginx on port 8080. It keeps no data, so it
needs no volume.

```sh
docker build -t ttrpg-player-toolkit .
docker run -d -p 8080:8080 ttrpg-player-toolkit
```

`docker compose up -d --build` does the same on `127.0.0.1:8090`.

## Project layout

```
src/App.jsx              Header, tabs and style picker
src/components/          Home, the dice rollers, Card Drawer and its piles, Notepad, Jenga and shared controls
src/lib/                 Dice, decks, card piles, Jenga odds, random numbers and image uploads
src/dice3d/              3D: three.js window table and roll mat, cannon-es physics, towers, dice.json, props.json
src/hooks/               useStoredState (a value kept in localStorage) and useDiceRoll (shared roller state)
public/dice/             Dice models, one .glb per set, and a thumbnail of each set in thumbs/
public/mats/             Roll mat surfaces (a color and a normal map each) and the rim models
public/towers/           Dice tower models, and a thumbnail of each in thumbs/
public/cards/tarot/      Tarot card images
tests/                   Vitest tests for src/, run in jsdom with Testing Library
coverage-index/          The test coverage landing page, the ronovos-coverage-index submodule
coverage-reports.json    This repo's entry for that page: its name and reports
```

The dice models, the mat surfaces, rims and towers, `dice.json` and `props.json` are built in Blender by the
`blender-asset-builder` repository. From that repository's folder, these write them straight into this one:

```sh
blender --background --factory-startup --python make_dice.py -- --out C:\Github\ttrpg-player-toolkit
blender --background --factory-startup --python make_props.py -- --out C:\Github\ttrpg-player-toolkit
```

Its README explains how the scripts work with Blender and how to make your own dice set.

## License

BSD 2-Clause. See [LICENSE](LICENSE).

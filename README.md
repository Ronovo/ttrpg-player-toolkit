# TTRPG Player Toolkit

A browser table for tabletop players: dice, playing card and tarot decks, a notepad and a Jenga tower. It is a
static React site with no server code; everything it keeps is saved in your browser.

## Features

- **Dice Roller:** roll 1 to 10 of a d4, d6, d8, d10, d12, d20 or d100. **Animate** throws them across a 3D table
  instead, in one of 26 dice sets (Basic, Premium and Weird).
- **Card Drawer:** build a stack from any number of playing card decks (with or without jokers) or tarot decks.
  Draw, shuffle, discard and shuffle the discard back in, and add another deck at any time. Tarot cards come up
  reversed half the time, and the Major and Minor Arcana can be split into two piles.
- **Notepad:** session notes.
- **Jenga:** a tower you pull blocks from. Each pull makes it more likely to fall, at Less Tense, Normal or More
  Tense, and it shows how it is holding up: Solid, Wobbly, Teetering or Doomed.
- Ten styles for the page: Tabletop, Parchment, Polished Dark, Casino, Eldritch, Neon, Dossier, Slasher,
  Field Kit and Forest.

The notes, the Jenga tower, the style and the dice set are kept in the browser's `localStorage`, so they are
separate for each browser and each address the site is served from.

## Running

Uses Node 24, the version the `Dockerfile` builds with.

```sh
npm install
npm run dev       # http://localhost:5173 with live reload
npm run build     # writes the site to dist/
npm run preview   # serves dist/
```

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
src/components/          Dice Roller, Card Drawer and its piles, Notepad, Jenga
src/lib/                 Dice, decks, card piles, Jenga odds and random numbers
src/dice3d/              3D dice table: three.js scene, cannon-es physics, dice.json
src/hooks/               useStoredState, which keeps a value in localStorage
public/dice/             Dice models, one .glb per set
public/cards/tarot/      Tarot card images
blender/make_dice.py     Builds public/dice/ and src/dice3d/dice.json in Blender
```

To rebuild the dice models:

```sh
blender --background --factory-startup --python blender/make_dice.py
```

## License

BSD 2-Clause. See [LICENSE](LICENSE).

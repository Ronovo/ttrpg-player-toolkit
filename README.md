# TTRPG Player Toolkit

A browser table for tabletop players: dice, playing card and tarot decks, a notepad and a Jenga tower. It is a
React site served by a small Flask server, which also offers portfolio login so a player can upload their own dice.
Everything else it keeps is saved in your browser.

## Features

Each tool has its own tab. **Home**, the first tab, starts with a quick dice roller and the notepad side by side and
the card drawer below; on a desktop it fits the window until a deck is built. **Edit layout**, the icon button in the
top bar, turns Home into a canvas you arrange into your own table, starting with every tool where it was. While
editing, the top bar holds **Add tool**, for any tool not already there, **Reset to default** and **Done**, and the
tabs show only their icons. Drag a tool anywhere, resize it from the corner (or move with the arrow keys and resize
with Shift and the arrow keys), or remove it. Tools can overlap, and the one clicked last comes to the front. A
changed layout is kept in this browser, and **Reset to default** brings back the starting Home. On a phone the tools
stack in one column, in the order they sit on the canvas.

- **Dice Roller:** roll 1 to 10 of a d4, d6, d8, d10, d12, d20 or d100. **Animate** throws them in 3D, in one of
  51 dice sets (Basic, Premium and Weird). Every set has its own finish, ink and number font. A category
  shows ten sets at a time, and arrows turn to its next page. Star a set to
  add it to **Favorites**, an extra category that shows once anything is starred. On Home the dice fly across the
  window, with a large preview of the chosen set; on the Dice Roller tab they land on a **roll mat** with a felt, velvet, leather, wood or stone
  surface in any color, or your own picture, and an optional wood or leather rim. Turn on **Tower** to stand a
  dice tower on the mat: the dice drop in through a hole in its top or side and roll out of its door. There are
  nine, from a lighthouse and a windmill to a rocket and a haunted tree.
- **Card Drawer:** build a stack from any number of playing card decks (with or without jokers) or tarot decks.
  Draw, shuffle, discard and shuffle the discard back in, and add another deck at any time. Tarot cards come up
  reversed half the time, and the Major and Minor Arcana can be split into two piles. Each pile shows its deck
  face down; click it to draw. The card backs follow the page style, or use a picture you upload.
- **My Dice:** with portfolio login on, the header offers **Log in with portfolio account**. A logged-in player can
  upload a dice set of their own on the Dice Roller tab: a name, a `.glb` exported from Blender and, if they like, a
  screenshot. Without a screenshot the set shows a plain die with its name. The model must hold seven objects named
  `d4`, `d6`, `d8`, `d10`, `d12`, `d20` and `d100` in the toolkit's dice shapes, with their transforms applied; the
  server checks that before keeping it. Uploads are 12 MB at most, ten sets to an account, and each account sees
  only its own, in a **My Dice** category.
- **Notepad:** session notes.
- **Character Sheet:** with portfolio login on, a logged-in player can upload one PDF character sheet. It opens in
  a PDF reader on the page, built on pdf.js, with zoom and fit-to-width. A fillable PDF can be filled in right
  there: what is typed is saved to the portfolio account two seconds after typing stops, so the sheet comes back
  filled in on any browser. **Download** saves the PDF with everything filled in to the browser's downloads folder.
  The server keeps the PDF as uploaded, 20 MB at most, and the typed values beside it. Uploading another PDF
  replaces the sheet.
- **Jenga:** a tower you pull blocks from. Each pull makes it more likely to fall, at Less Tense, Normal or More
  Tense, and it shows how it is holding up: Solid, Wobbly, Teetering or Doomed.
- Ten styles for the page, each with its own heading font and backdrop: Tabletop, Parchment, Polished Dark,
  Casino, Eldritch, Neon, Dossier, Slasher, Field Kit and Forest.

The notes, the Jenga tower, the style, the dice set, the favorites, the roll mat, the tower and the card back are
kept in the browser's `localStorage`, so they are separate for each browser and each address the site is served
from. Uploaded dice sets are kept by the server, under its data folder.

## Running

Uses Node 24 and Python 3.12, the versions the `Dockerfile` builds with.

```sh
npm install
npm run dev       # http://localhost:5173 with live reload
npm run build     # writes the site to dist/
npm run preview   # serves dist/
npm test          # the Vitest tests in tests/
npm run coverage  # the same, with an HTML report in coverage/js that fails below 100%
```

The server serves `dist/` and adds login and uploads. `npm run dev` sends `/api` and `/sso` to it on port 8080:

```sh
pip install -e .[test]
flask --app server run --port 8080
python -m coverage run -m unittest discover -s tests/python -t . && python -m coverage report
```

| Variable | What it does |
| --- | --- |
| `PORTFOLIO_SSO_URL`, `PORTFOLIO_SSO_PUBLIC_KEY` | The portfolio to log in through and the key its login tokens are checked with. Login and uploads are on only when both are set. |
| `TOOLKIT_SECRET_KEY` | Signs the session cookie. Without it each start makes a new key and logs everyone out. |
| `SECURE_COOKIES` | `1` marks the session cookie HTTPS-only, for use behind the tunnel. |
| `DATA_DIR` | Where uploaded sets and their database go. `data/` by default, `/app/data` in the image. |

The Docker image also builds the coverage report and serves it at `/coverage/`, under the landing page in
`coverage-index/`, the `ronovos-coverage-index` submodule, with this repo's `coverage-reports.json`. Failing tests
or low coverage don't stop the image build; the report shows what is missing.

### Docker

The `Dockerfile` builds the site, runs both test suites for the coverage report, and serves everything with
gunicorn on port 8080. Uploaded dice live in `/app/data`, so give it a volume there.

```sh
docker build -t ttrpg-player-toolkit .
docker run -d -p 8080:8080 -v ttrpg-toolkit-data:/app/data ttrpg-player-toolkit
```

`docker compose up -d --build` does the same on `127.0.0.1:8090`.

## Project layout

```
src/App.jsx              Header, tabs and style picker
src/components/          Home and its canvas windows, the tools, and shared controls
src/lib/                 Dice, decks, card piles, Jenga odds, random numbers and image uploads
src/dice3d/              3D: three.js window table and roll mat, cannon-es physics, towers, dice.json, props.json
src/hooks/               useStoredState (a value kept in localStorage), useDiceRoll (shared roller state) and
                         useAccount (the portfolio login and the account's uploaded sets)
server/                  The Flask server: the site, portfolio login (login.py), dice uploads (dice.py), the model
                         check (glb.py), the character sheet (sheet.py) and their shared storage (storage.py)
src/sheet/               The PDF reader for the character sheet, on pdf.js
public/dice/             Dice models, one .glb per set, and a thumbnail of each set in thumbs/
public/mats/             Roll mat surfaces (a color and a normal map each) and the rim models
public/towers/           Dice tower models, and a thumbnail of each in thumbs/
public/cards/tarot/      Tarot card images
tests/                   Vitest tests for src/, run in jsdom with Testing Library, and tests/python/ for server/
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

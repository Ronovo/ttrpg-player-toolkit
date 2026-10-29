import { randomInt, shuffle } from "./random.js";
import { buildPlayingDeck, buildTarotDeck } from "./decks.js";

export const REVERSED_CHANCE_PERCENT = 50;

function newPile(name) {
  return { name, drawPile: [], drawn: [], discard: [] };
}

export function createStack(type, deckCount, includeJokers, splitArcana) {
  const isTarot = type === "tarot";
  const split = isTarot && splitArcana;
  let piles;
  if (split) {
    piles = [newPile("Major Arcana"), newPile("Minor Arcana")];
  } else {
    piles = [newPile(isTarot ? "Tarot" : "Playing Cards")];
  }
  let stack = {
    type,
    includeJokers: !isTarot && includeJokers,
    splitArcana: split,
    deckCount: 0,
    piles,
  };
  for (let i = 0; i < deckCount; i++) {
    stack = addDeck(stack);
  }
  return stack;
}

export function addDeck(stack) {
  const cards = stack.type === "tarot" ? buildTarotDeck() : buildPlayingDeck(stack.includeJokers);
  const newCards = stack.splitArcana
    ? [cards.filter((card) => card.arcana === "major"), cards.filter((card) => card.arcana === "minor")]
    : [cards];
  return {
    ...stack,
    deckCount: stack.deckCount + 1,
    piles: stack.piles.map((pile, i) => ({
      ...pile,
      drawPile: shuffle([...pile.drawPile, ...newCards[i]]),
    })),
  };
}

export function drawCard(pile, canReverse) {
  const card = pile.drawPile[pile.drawPile.length - 1];
  const reversed = canReverse && randomInt(100) < REVERSED_CHANCE_PERCENT;
  return {
    ...pile,
    drawPile: pile.drawPile.slice(0, -1),
    drawn: [...pile.drawn, { card, reversed }],
  };
}

export function shufflePile(pile) {
  return { ...pile, drawPile: shuffle([...pile.drawPile]) };
}

export function discardDrawn(pile) {
  return {
    ...pile,
    drawn: [],
    discard: [...pile.discard, ...pile.drawn.map((entry) => entry.card)],
  };
}

export function shuffleDiscardIn(pile) {
  return {
    ...pile,
    drawPile: shuffle([...pile.drawPile, ...pile.discard]),
    discard: [],
  };
}

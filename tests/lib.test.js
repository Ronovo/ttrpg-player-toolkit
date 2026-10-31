import { afterEach, describe, expect, it, vi } from 'vitest';
import { diceResult } from '../src/lib/dice.js';
import { randomFraction, randomInt, shuffle } from '../src/lib/random.js';
import { buildPlayingDeck, buildTarotDeck } from '../src/lib/decks.js';
import {
  REVERSED_CHANCE_PERCENT, addDeck, createStack, discardDrawn, drawCard, shuffleDiscardIn, shufflePile,
} from '../src/lib/cards.js';
import { TENSIONS, condition, fallenSoFar, leanAmount, newTower, pull } from '../src/lib/jenga.js';
import { fileToDataUrl } from '../src/lib/images.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/* Makes crypto.getRandomValues hand out these numbers in turn. */
function randomValues(...values) {
  const queue = [...values];
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((buffer) => {
    buffer[0] = queue.length ? queue.shift() : 0;
    return buffer;
  });
}

describe('dice', () => {
  it('adds up the rolls', () => {
    expect(diceResult(3, 6, [1, 4, 6])).toEqual({ count: 3, sides: 6, rolls: [1, 4, 6], total: 11 });
  });
});

describe('random numbers', () => {
  it('draws again past the last whole multiple so every number is equally likely', () => {
    const limit = Math.floor(0x100000000 / 6) * 6;
    randomValues(limit, limit + 1, 13);
    expect(randomInt(6)).toBe(1);
    expect(crypto.getRandomValues).toHaveBeenCalledTimes(3);
  });

  it('gives fractions from 0 up to but not including 1', () => {
    randomValues(999_999);
    expect(randomFraction()).toBe(0.999999);
  });

  it('shuffles in place and keeps every item', () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items)).toBe(items);
    expect([...items].sort()).toEqual([1, 2, 3, 4, 5]);
    randomValues(0, 0, 0, 0);
    expect(shuffle(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });
});

describe('decks', () => {
  it('builds 52 playing cards, plus two jokers when asked', () => {
    const deck = buildPlayingDeck(false);
    expect(deck).toHaveLength(52);
    expect(deck[0]).toEqual({ id: 'playing-hearts-a', name: 'Ace of Hearts', face: 'Ha' });
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    expect(buildPlayingDeck(true).slice(-2).map((card) => card.name)).toEqual(['Red Joker', 'Black Joker']);
  });

  it('builds the 78 tarot cards with their images', () => {
    const deck = buildTarotDeck();
    expect(deck).toHaveLength(78);
    expect(deck.filter((card) => card.arcana === 'major')).toHaveLength(22);
    expect(deck[0]).toEqual({ id: 'tarot-major-00', name: 'The Fool', arcana: 'major',
      image: '/cards/tarot/tarot-major-00.jpg' });
    expect(deck.at(-1).name).toBe('King of Pentacles');
  });
});

describe('card piles', () => {
  it('stacks as many decks as asked into one pile', () => {
    const stack = createStack('playing', 2, true, true);
    expect(stack).toMatchObject({ type: 'playing', includeJokers: true, splitArcana: false, deckCount: 2 });
    expect(stack.piles.map((pile) => [pile.name, pile.drawPile.length])).toEqual([['Playing Cards', 108]]);
  });

  it('splits a tarot stack into major and minor arcana on request', () => {
    const stack = createStack('tarot', 1, true, true);
    expect(stack.includeJokers).toBe(false);
    expect(stack.piles.map((pile) => [pile.name, pile.drawPile.length])).toEqual([['Major Arcana', 22],
      ['Minor Arcana', 56]]);
    expect(createStack('tarot', 1, false, false).piles.map((pile) => pile.name)).toEqual(['Tarot']);
  });

  it('adds a deck to what is still in the pile', () => {
    const stack = createStack('playing', 1, false, false);
    const dealt = { ...stack, piles: [drawCard(stack.piles[0], false)] };
    expect(addDeck(dealt).piles[0].drawPile).toHaveLength(51 + 52);
  });

  it('draws from the top and turns cards over only when reversing is allowed', () => {
    const pile = { name: 'P', drawPile: ['a', 'b', 'c'], drawn: [], discard: [] };
    randomValues(REVERSED_CHANCE_PERCENT - 1, REVERSED_CHANCE_PERCENT);
    const first = drawCard(pile, true);
    expect(first).toEqual({ name: 'P', drawPile: ['a', 'b'], drawn: [{ card: 'c', reversed: true }], discard: [] });
    expect(drawCard(first, true).drawn[1]).toEqual({ card: 'b', reversed: false });
    expect(drawCard(pile, false).drawn[0].reversed).toBe(false);
    expect(pile.drawPile).toEqual(['a', 'b', 'c']);
  });

  it('discards what was drawn and shuffles the discards back in', () => {
    const pile = { name: 'P', drawPile: ['a'], drawn: [{ card: 'b', reversed: true }], discard: ['c'] };
    const discarded = discardDrawn(pile);
    expect(discarded).toEqual({ name: 'P', drawPile: ['a'], drawn: [], discard: ['c', 'b'] });
    const back = shuffleDiscardIn(discarded);
    expect([...back.drawPile].sort()).toEqual(['a', 'b', 'c']);
    expect(back.discard).toEqual([]);
    expect([...shufflePile(back).drawPile].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('Jenga', () => {
  const at = (pulls, tension = 'normal') => ({ ...newTower(tension), pulls });

  it('starts as 18 full levels leaning one way or the other', () => {
    randomValues(0, 1);
    const left = newTower('normal');
    expect(left).toMatchObject({ tension: 'normal', pulls: 0, fallen: false, leanSide: -1 });
    expect(left.levels).toHaveLength(18);
    expect(left.levels.every((level) => level.every(Boolean))).toBe(true);
    expect(newTower('normal').leanSide).toBe(1);
  });

  it('matches what players report: 90% standing after 20 pulls and 50% after 30', () => {
    expect(1 - fallenSoFar(at(20))).toBeCloseTo(0.9, 2);
    expect(1 - fallenSoFar(at(30))).toBeCloseTo(0.5, 2);
  });

  it('wears faster when the table plays it tense', () => {
    expect(TENSIONS.map((tension) => tension.id)).toEqual(['less-tense', 'normal', 'more-tense']);
    expect(fallenSoFar(at(20, 'more-tense'))).toBeGreaterThan(fallenSoFar(at(20)));
    expect(fallenSoFar(at(20, 'less-tense'))).toBeLessThan(fallenSoFar(at(20)));
  });

  it('describes the tower as it gets worse', () => {
    expect([0, 22, 28, 33, 60].map((pulls) => condition(at(pulls)))).toEqual(
      ['Solid', 'Solid', 'Wobbly', 'Teetering', 'Doomed']);
  });

  it('leans further as the odds of falling grow', () => {
    const tower = { ...at(30), leanSide: -1 };
    expect(leanAmount(tower)).toBeCloseTo(-Math.sqrt(fallenSoFar(tower)));
    expect(Math.abs(leanAmount(at(0)))).toBe(0);
  });

  it('moves a pulled block to the top', () => {
    randomValues(0, 0, 0);
    const tower = newTower('normal');
    const after = pull(tower);
    expect(after.pulls).toBe(1);
    expect(after.levels[0]).toEqual([false, true, true]);
    expect(after.levels).toHaveLength(19);
    expect(after.levels[18]).toEqual([true, false, false]);
    expect(pull(after).levels[18]).toEqual([true, true, false]);
  });

  it('never pulls from the top level, or from the one below while the top is being built', () => {
    randomValues(0, 0, 999_999_999);
    const tower = { ...newTower('normal'), levels: [[true, true, true], [true, true, true], [true, false, false]] };
    const after = pull(tower);
    expect(after.levels[1]).toEqual([true, true, true]);
    expect(after.levels[0]).toEqual([false, true, true]);
  });

  it('only takes blocks that leave a level standing square, until there is no other choice', () => {
    randomValues(0, 0, 999_999_999);
    const levels = [[true, true, false], [true, false, true], [false, true, false], [true, true, true],
      [true, true, true]];
    const after = pull({ ...newTower('normal'), levels });
    expect(after.levels[0]).toEqual([false, true, false]);
    expect(after.levels[1]).toEqual([true, false, true]);
    const stuck = [[true, false, true], [false, true, false], [true, true, true]];
    randomValues(0, 0, 999_999_999);
    expect(pull({ ...newTower('normal'), levels: stuck }).levels[0]).toEqual([false, false, true]);
  });

  it('stops taking blocks when every level is down to one', () => {
    const levels = [[false, true, false], [true, false, false], [true, true, true]];
    randomValues(999_999_999);
    expect(pull({ ...newTower('normal'), levels }).levels).toBe(levels);
  });

  it('falls on a pull when the roll is under the chance of falling on that pull', () => {
    const tower = at(29);
    randomValues(0, 0);
    expect(pull(tower).fallen).toBe(true);
    randomValues(0, 999_999);
    expect(pull(tower).fallen).toBe(false);
  });
});

describe('uploaded pictures', () => {
  function picture(width, height) {
    const bitmap = { width, height, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,AA');
    return { bitmap, drawImage, toDataURL };
  }

  it('shrinks a large picture to fit and saves it as WebP', async () => {
    const { bitmap, drawImage, toDataURL } = picture(2000, 1000);
    expect(await fileToDataUrl(new Blob(['x']), 500)).toBe('data:image/webp;base64,AA');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 500, 250);
    expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.85);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('never enlarges a small picture', async () => {
    const { bitmap, drawImage } = picture(120, 300);
    await fileToDataUrl(new Blob(['x']), 500);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 120, 300);
  });
});

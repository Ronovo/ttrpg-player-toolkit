import { randomFraction, randomInt } from "./random.js";

export const TENSIONS = [
  { id: "less-tense", label: "Less Tense", wear: 0.75 },
  { id: "normal", label: "Normal", wear: 1 },
  { id: "more-tense", label: "More Tense", wear: 1.9 },
];

const STARTING_LEVELS = 18;

// Chance the tower is still standing after a given amount of wear. At 1 wear per pull this is
// a 90% chance of surviving 20 pulls and a 50% chance of surviving 30, from players' reports.
const SCALE = 32.5;
const SHAPE = 4.65;

function standingChance(wear) {
  return Math.exp(-((wear / SCALE) ** SHAPE));
}

const CONDITIONS = [
  { below: 0.2, label: "Solid" },
  { below: 0.5, label: "Wobbly" },
  { below: 0.8, label: "Teetering" },
  { below: Infinity, label: "Doomed" },
];

export function newTower(tension) {
  return {
    tension,
    levels: Array.from({ length: STARTING_LEVELS }, () => [true, true, true]),
    pulls: 0,
    fallen: false,
    leanSide: randomInt(2) ? 1 : -1,
  };
}

function wearPerPull(tower) {
  return TENSIONS.find((tension) => tension.id === tower.tension).wear;
}

export function fallenSoFar(tower) {
  return 1 - standingChance(tower.pulls * wearPerPull(tower));
}

export function condition(tower) {
  const fallen = fallenSoFar(tower);
  return CONDITIONS.find((c) => fallen < c.below).label;
}

// From -1 to 1. The square root makes the lean show early and keep growing toward the end.
export function leanAmount(tower) {
  return tower.leanSide * Math.sqrt(fallenSoFar(tower));
}

// A level can lose a block as long as what is left sits square: the middle alone, or two blocks.
// Once no level allows that, a block may come from any level that keeps at least one block.
function removableSlots(level, lastResort) {
  const count = level.filter(Boolean).length;
  if (count === 3) return [0, 1, 2];
  if (count === 2 && (lastResort || level[1])) {
    return [0, 1, 2].filter((slot) => level[slot] && (lastResort || slot !== 1));
  }
  return [];
}

function choicesBelow(levels, highestBuilt, lastResort) {
  return levels
    .slice(0, highestBuilt)
    .flatMap((level, i) => removableSlots(level, lastResort).map((slot) => [i, slot]));
}

// Blocks can't come from the top level or, while it is still being built, the level under it.
function pullBlock(levels) {
  const top = levels.length - 1;
  const highestBuilt = levels[top].every(Boolean) ? top : top - 1;
  const choices = choicesBelow(levels, highestBuilt, false);
  if (!choices.length) choices.push(...choicesBelow(levels, highestBuilt, true));
  if (!choices.length) return levels;
  const next = levels.map((level) => [...level]);
  const [i, slot] = choices[randomInt(choices.length)];
  next[i][slot] = false;
  if (next[top].every(Boolean)) {
    next.push([true, false, false]);
  } else {
    next[top][next[top].indexOf(false)] = true;
  }
  return next;
}

export function pull(tower) {
  const wear = wearPerPull(tower);
  const before = standingChance(tower.pulls * wear);
  const after = standingChance((tower.pulls + 1) * wear);
  const fallChance = 1 - after / before;
  return {
    ...tower,
    levels: pullBlock(tower.levels),
    pulls: tower.pulls + 1,
    fallen: randomFraction() < fallChance,
  };
}

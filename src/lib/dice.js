import { randomInt } from "./random.js";

export function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(randomInt(sides) + 1);
  }
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  return { count, sides, rolls, total };
}

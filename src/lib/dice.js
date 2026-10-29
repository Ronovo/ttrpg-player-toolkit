export function diceResult(count, sides, rolls) {
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  return { count, sides, rolls, total };
}

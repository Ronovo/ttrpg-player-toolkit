import { useMemo, useRef, useState } from "react";
import { diceResult } from "../lib/dice.js";
import { DICE_SETS, allSets } from "../lib/diceSets.js";
import { randomInt } from "../lib/random.js";
import useAccount from "./useAccount.jsx";
import useStoredState, { parseStored } from "./useStoredState.js";

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
export const DEFAULT_SIDES = 6;
export const MAX_DICE = 10;

// Every set this visitor can roll: the built-in ones and the account's uploads.
export function useDiceSets() {
  const { customSets } = useAccount();
  return useMemo(() => allSets(customSets), [customSets]);
}

// The chosen set's id, its setter, and the set itself.
export function useDiceSet() {
  const sets = useDiceSets();
  const [id, setId] = useStoredState("ttrpg-toolkit-dice-set", DICE_SETS[0].id, sets.map((set) => set.id));
  return [id, setId, sets.find((set) => set.id === id)];
}

// The ids of the dice sets starred as favorites, kept as a JSON list.
export function useFavorites() {
  const ids = useDiceSets().map((set) => set.id);
  const [saved, setSaved] = useStoredState("ttrpg-toolkit-dice-favorites", "[]");
  const stored = parseStored(saved, []);
  const favorites = (Array.isArray(stored) ? stored : []).filter((id) => ids.includes(id));

  function toggleFavorite(id) {
    setSaved(JSON.stringify(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]));
  }

  return [favorites, toggleFavorite];
}

// A roller's dice count, die type and latest result. `roll(throwDice)` rolls with `throwDice(count, sides)`,
// which resolves to the values, or to null when a newer roll replaced it. Without it the numbers are drawn.
export default function useDiceRoll() {
  const [count, setCount] = useState("1");
  const [sides, setSides] = useState(DEFAULT_SIDES);
  const [result, setResult] = useState(null);
  const latestRoll = useRef(0);

  function changeCount(by) {
    setCount((current) => String(Math.min(MAX_DICE, Math.max(1, (Number(current) || 1) + by))));
  }

  async function roll(throwDice) {
    const diceCount = Number(count);
    const rollId = ++latestRoll.current;
    setResult(null);
    const rolls = throwDice
      ? await throwDice(diceCount, sides)
      : Array.from({ length: diceCount }, () => randomInt(sides) + 1);
    if (rolls && rollId === latestRoll.current) setResult(diceResult(diceCount, sides, rolls));
  }

  return { count, setCount, changeCount, sides, setSides, result, roll };
}

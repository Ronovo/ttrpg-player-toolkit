import { useRef, useState } from "react";
import { diceResult } from "../lib/dice.js";
import { randomInt } from "../lib/random.js";
import useStoredState, { parseStored } from "./useStoredState.js";
import diceData from "../dice3d/dice.json";

export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
export const MAX_DICE = 10;
export const DICE_SETS = diceData.sets;
export const CATEGORIES = [...new Set(DICE_SETS.map((s) => s.category))];
export const FAVORITES = "Favorites";
const DICE_SET_IDS = DICE_SETS.map((s) => s.id);

export function useDiceSet() {
  return useStoredState("ttrpg-toolkit-dice-set", DICE_SET_IDS[0], DICE_SET_IDS);
}

// The ids of the dice sets starred as favorites, kept as a JSON list.
export function useFavorites() {
  const [saved, setSaved] = useStoredState("ttrpg-toolkit-dice-favorites", "[]");
  const ids = parseStored(saved, []);
  const favorites = (Array.isArray(ids) ? ids : []).filter((id) => DICE_SET_IDS.includes(id));

  function toggleFavorite(id) {
    setSaved(JSON.stringify(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]));
  }

  return [favorites, toggleFavorite];
}

// The sets in a category; Favorites holds the starred ones, in the usual set order.
export function setsIn(category, favorites) {
  return DICE_SETS.filter((s) => (category === FAVORITES ? favorites.includes(s.id) : s.category === category));
}

// A roller's dice count, die type and latest result. `roll(throwDice)` rolls with `throwDice(count, sides)`,
// which resolves to the values, or to null when a newer roll replaced it. Without it the numbers are drawn.
export default function useDiceRoll() {
  const [count, setCount] = useState("1");
  const [sides, setSides] = useState(DICE_SIDES[0]);
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

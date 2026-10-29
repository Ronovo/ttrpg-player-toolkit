import { useEffect, useRef, useState } from "react";
import { diceResult } from "../lib/dice.js";
import { randomInt } from "../lib/random.js";
import useStoredState from "../hooks/useStoredState.js";
import diceData from "../dice3d/dice.json";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const DICE_SETS = diceData.sets;
const DICE_SET_IDS = DICE_SETS.map((s) => s.id);
const CATEGORIES = [...new Set(DICE_SETS.map((s) => s.category))];

function RollResult({ result }) {
  return (
    <>
      <span className="roll-label">{result.count}d{result.sides}</span>
      <ul className="roll-dice">
        {result.rolls.map((roll, i) => (
          <li key={i} className="die">{roll}</li>
        ))}
      </ul>
      <span className="roll-total">{result.total}</span>
    </>
  );
}

export default function DiceRoller() {
  const [count, setCount] = useState("1");
  const [sides, setSides] = useState(DICE_SIDES[0]);
  const [animate, setAnimate] = useState(false);
  const [result, setResult] = useState(null);
  const [diceSet, setDiceSet] = useStoredState("ttrpg-toolkit-dice-set", DICE_SET_IDS[0], DICE_SET_IDS);
  const latestRoll = useRef(0);
  const category = DICE_SETS.find((s) => s.id === diceSet).category;

  useEffect(() => {
    if (animate) import("../dice3d/table.js").then(({ prepareTable }) => prepareTable(diceSet));
  }, [animate, diceSet]);

  async function handleSubmit(event) {
    event.preventDefault();
    const diceCount = Number(count);
    const rollId = ++latestRoll.current;
    setResult(null);
    let rolls;
    if (animate) {
      const { rollOnTable } = await import("../dice3d/table.js");
      rolls = await rollOnTable(diceCount, sides, diceSet);
    } else {
      rolls = Array.from({ length: diceCount }, () => randomInt(sides) + 1);
    }
    if (rolls && rollId === latestRoll.current) setResult(diceResult(diceCount, sides, rolls));
  }

  return (
    <section className="panel dice-roller">
      <h2>Dice Roller</h2>
      <form className="dice-form" onSubmit={handleSubmit}>
        <div className="controls">
          <label>
            Dice
            <input
              type="number"
              min="1"
              max="10"
              required
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
          <label>
            Type
            <select value={sides} onChange={(event) => setSides(Number(event.target.value))}>
              {DICE_SIDES.map((s) => (
                <option key={s} value={s}>d{s}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={animate}
              onChange={(event) => setAnimate(event.target.checked)}
            />
            Animate
          </label>
          <button type="submit">Roll</button>
        </div>
        <div className={`controls${animate ? "" : " idle"}`}>
          <label>
            Category
            <select
              value={category}
              onChange={(event) => setDiceSet(DICE_SETS.find((s) => s.category === event.target.value).id)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Set
            <select value={diceSet} onChange={(event) => setDiceSet(event.target.value)}>
              {DICE_SETS.filter((s) => s.category === category).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </form>
      <div className="roll-result" aria-live="polite">
        {result && <RollResult result={result} />}
      </div>
    </section>
  );
}

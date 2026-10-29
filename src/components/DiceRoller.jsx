import { useState } from "react";
import { rollDice } from "../lib/dice.js";

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

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
  const [result, setResult] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    setResult(rollDice(Number(count), sides));
  }

  return (
    <section className="panel dice-roller">
      <h2>Dice Roller</h2>
      <form className="controls" onSubmit={handleSubmit}>
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
        <button type="submit">Roll</button>
      </form>
      <div className="roll-result" aria-live="polite">
        {result && <RollResult result={result} />}
      </div>
    </section>
  );
}

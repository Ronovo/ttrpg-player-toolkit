import { MAX_DICE } from "../hooks/useDiceRoll.js";
import Icon from "./Icon.jsx";

export function DiceCount({ count, setCount, changeCount }) {
  return (
    <div className="stepper">
      <button type="button" className="secondary" aria-label="Fewer dice" disabled={Number(count) <= 1} onClick={() => changeCount(-1)}>
        <Icon name="minus" />
      </button>
      <input
        type="number"
        min="1"
        max={MAX_DICE}
        required
        aria-label="Dice"
        value={count}
        onChange={(event) => setCount(event.target.value)}
      />
      <button type="button" className="secondary" aria-label="More dice" disabled={Number(count) >= MAX_DICE} onClick={() => changeCount(1)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function RollResult({ result }) {
  return (
    <div className="roll-result" aria-live="polite">
      {result && (
        <>
          <span className="roll-label">{result.count}d{result.sides}</span>
          <ul className="roll-dice">
            {result.rolls.map((roll, i) => (
              <li key={i} className="die">{roll}</li>
            ))}
          </ul>
          <span className="roll-total">{result.total}</span>
        </>
      )}
    </div>
  );
}

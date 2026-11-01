import { DICE_SIDES, MAX_DICE } from "../hooks/useDiceRoll.js";
import Icon from "./Icon.jsx";

export function DiePicker({ sides, setSides }) {
  return (
    <fieldset className="die-picker">
      <legend>Die</legend>
      {DICE_SIDES.map((s) => (
        <label key={s} className="die-option">
          <input
            type="radio"
            name="sides"
            className="visually-hidden"
            checked={sides === s}
            onChange={() => setSides(s)}
          />
          <Icon name={`d${s}`} />
          d{s}
        </label>
      ))}
    </fieldset>
  );
}

export function DiceCount({ count, setCount, changeCount }) {
  return (
    <div className="field">
      <span>Dice</span>
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
    </div>
  );
}

function dieClass(roll, sides) {
  if (roll === sides) return "die max";
  return roll === 1 ? "die min" : "die";
}

export function RollResult({ result }) {
  return (
    <div className="roll-result" aria-live="polite">
      {result ? (
        <>
          <span className="roll-label">
            <Icon name={`d${result.sides}`} />
            {result.count}d{result.sides}
          </span>
          <ul className="roll-dice">
            {result.rolls.map((roll, i) => (
              <li key={i} className={dieClass(roll, result.sides)} style={{ "--i": i }}>{roll}</li>
            ))}
          </ul>
          <span className="roll-total">{result.total}</span>
        </>
      ) : (
        <span className="roll-hint">Pick your dice and roll</span>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import useDiceRoll, { DICE_SIDES, useDiceSet } from "../hooks/useDiceRoll.js";
import { DiceCount, RollResult } from "./DiceParts.jsx";
import Icon from "./Icon.jsx";
import SetPicker, { setThumbnail } from "./SetPicker.jsx";

export default function QuickRoller() {
  const { count, setCount, changeCount, sides, setSides, result, roll } = useDiceRoll();
  const [animate, setAnimate] = useState(false);
  const [diceSet, setDiceSet] = useDiceSet();

  useEffect(() => {
    if (animate) import("../dice3d/table.js").then(({ prepareTable }) => prepareTable(diceSet));
  }, [animate, diceSet]);

  function handleSubmit(event) {
    event.preventDefault();
    roll(animate && ((n, s) => import("../dice3d/table.js").then(({ rollOnTable }) => rollOnTable(n, s, diceSet))));
  }

  return (
    <section className="panel quick-roller">
      <h2><Icon name="d20" />Dice Roller</h2>
      <form className="dice-form" onSubmit={handleSubmit}>
        <div className="roll-controls">
          <div className="field">
            <span>Dice</span>
            <DiceCount count={count} setCount={setCount} changeCount={changeCount} />
          </div>
          <label>
            Type
            <select value={sides} onChange={(event) => setSides(Number(event.target.value))}>
              {DICE_SIDES.map((s) => (
                <option key={s} value={s}>d{s}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="roll-button">Roll</button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            role="switch"
            checked={animate}
            onChange={(event) => setAnimate(event.target.checked)}
          />
          Animate
        </label>
        {animate && (
          <div className="quick-sets">
            <div className="set-picker">
              <SetPicker diceSet={diceSet} setDiceSet={setDiceSet} />
            </div>
            <img className="set-preview" src={setThumbnail(diceSet)} alt="" />
          </div>
        )}
      </form>
      <RollResult result={result} />
    </section>
  );
}

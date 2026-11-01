import { useEffect, useState } from "react";
import useDiceRoll, { useDiceSet } from "../hooks/useDiceRoll.js";
import { thumbnailUrl } from "../lib/diceSets.js";
import { DiceCount, DiePicker, RollResult } from "./DiceParts.jsx";
import Icon from "./Icon.jsx";
import SetPicker from "./SetPicker.jsx";

export default function QuickRoller() {
  const { count, setCount, changeCount, sides, setSides, result, roll } = useDiceRoll();
  const [animate, setAnimate] = useState(false);
  const [diceSet, setDiceSet, chosenSet] = useDiceSet();
  const preview = thumbnailUrl(chosenSet);

  useEffect(() => {
    if (animate) import("../dice3d/table.js").then(({ prepareTable }) => prepareTable(chosenSet));
  }, [animate, chosenSet]);

  function handleSubmit(event) {
    event.preventDefault();
    roll(animate && ((n, s) => import("../dice3d/table.js").then(({ rollOnTable }) => rollOnTable(n, s, chosenSet))));
  }

  return (
    <section className="panel quick-roller">
      <h2><Icon name="d20" />Dice Roller</h2>
      <form className="dice-form" onSubmit={handleSubmit}>
        <DiePicker sides={sides} setSides={setSides} />
        <div className="roll-controls">
          <DiceCount count={count} setCount={setCount} changeCount={changeCount} />
          <label className="check">
            <input
              type="checkbox"
              role="switch"
              checked={animate}
              onChange={(event) => setAnimate(event.target.checked)}
            />
            Animate
          </label>
          <button type="submit" className="action-button">Roll</button>
        </div>
        <div className={`quick-sets${animate ? "" : " idle"}`} inert={!animate}>
          <div className="set-picker">
            <SetPicker diceSet={diceSet} setDiceSet={setDiceSet} />
          </div>
          {preview ? <img className="set-preview" src={preview} alt="" /> : <Icon name="d20" className="set-preview" />}
        </div>
      </form>
      <RollResult result={result} />
    </section>
  );
}

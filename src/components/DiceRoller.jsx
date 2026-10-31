import { useEffect, useRef, useState } from "react";
import props from "../dice3d/props.json";
import useDiceRoll, { DICE_SIDES, useDiceSet } from "../hooks/useDiceRoll.js";
import useStoredState from "../hooks/useStoredState.js";
import { DiceCount, RollResult } from "./DiceParts.jsx";
import Icon from "./Icon.jsx";
import ImageUpload from "./ImageUpload.jsx";
import Segmented from "./Segmented.jsx";
import SetPicker from "./SetPicker.jsx";
import TowerPicker, { NO_TOWER, TOWER_IDS } from "./TowerPicker.jsx";

const MAT_IMAGE_SIZE = 1600;
const SURFACE_IDS = props.surfaces.map((surface) => surface.id);
const RIM_IDS = props.rims.map((rim) => rim.id);

function loadTable() {
  return import("../dice3d/table.js");
}

function RollMat({ surface, color, image, rim, tower }) {
  const container = useRef(null);

  useEffect(() => {
    let unmount = null;
    let mounted = true;
    loadTable().then(({ mountMat }) => {
      if (mounted) unmount = mountMat(container.current);
    });
    return () => {
      mounted = false;
      unmount?.();
    };
  }, []);

  useEffect(() => {
    loadTable().then(({ setMat }) => setMat({ surface, color, image, rim }));
  }, [surface, color, image, rim]);

  useEffect(() => {
    loadTable().then(({ setTower }) => setTower(tower));
  }, [tower]);

  return <div className="mat-view" ref={container} />;
}

export default function DiceRoller() {
  const { count, setCount, changeCount, sides, setSides, result, roll } = useDiceRoll();
  const [animate, setAnimate] = useState(false);
  const [diceSet, setDiceSet] = useDiceSet();
  const [surface, setSurface] = useStoredState("ttrpg-toolkit-mat-surface", SURFACE_IDS[0], SURFACE_IDS);
  const [color, setColor] = useStoredState("ttrpg-toolkit-mat-color", props.surfaces[0].color);
  const [image, setImage] = useStoredState("ttrpg-toolkit-mat-image", "");
  const [rim, setRim] = useStoredState("ttrpg-toolkit-mat-rim", RIM_IDS[0], RIM_IDS);
  const [tower, setTower] = useStoredState("ttrpg-toolkit-tower", NO_TOWER, TOWER_IDS);

  useEffect(() => {
    if (animate) loadTable().then(({ prepareMat }) => prepareMat(diceSet));
  }, [animate, diceSet]);

  function chooseSurface(id) {
    setSurface(id);
    setColor(props.surfaces.find((s) => s.id === id).color);
  }

  function handleSubmit(event) {
    event.preventDefault();
    roll(animate && ((n, s) => loadTable().then(({ rollOnMat }) => rollOnMat(n, s, diceSet))));
  }

  return (
    <main className={animate ? "dice-page animated" : "dice-page"}>
      <section className="panel dice-roller">
        <h2><Icon name="d20" />Dice Roller</h2>
        <form className="dice-form" onSubmit={handleSubmit}>
          <fieldset className="die-picker">
            <legend className="visually-hidden">Type</legend>
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
            <button type="submit" className="roll-button">Roll</button>
          </div>
          <div className={`set-picker${animate ? "" : " idle"}`} inert={!animate}>
            <SetPicker diceSet={diceSet} setDiceSet={setDiceSet} />
          </div>
        </form>
        <RollResult result={result} />
      </section>

      {animate && (
        <>
          <section className="panel mat-panel">
            <h2><Icon name="castle" />Roll Mat</h2>
            <RollMat surface={surface} color={color} image={image} rim={rim} tower={tower} />
          </section>

          <section className="panel mat-settings">
            <h2><Icon name="palette" />Mat &amp; Tower</h2>
            <div className="setting">
              <h3>Surface</h3>
              <Segmented name="surface" label="Surface" options={props.surfaces} value={surface} onChange={chooseSurface} />
            </div>
            <div className="setting setting-row">
              <label className="color-field">
                Color
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </label>
              <ImageUpload label="Mat image" maxSize={MAT_IMAGE_SIZE} onChange={setImage} />
              {image && (
                <button type="button" className="secondary" onClick={() => setImage("")}>Remove image</button>
              )}
            </div>
            <div className="setting">
              <h3>Rim</h3>
              <Segmented name="rim" label="Rim" options={props.rims} value={rim} onChange={setRim} />
            </div>
            <TowerPicker tower={tower} setTower={setTower} />
          </section>
        </>
      )}
    </main>
  );
}

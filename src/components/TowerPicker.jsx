import { useState } from "react";
import props from "../dice3d/props.json";
import PagedGrid, { pageOf } from "./PagedGrid.jsx";
import Segmented from "./Segmented.jsx";

export const NO_TOWER = "none";
export const TOWER_IDS = [NO_TOWER, ...props.towers.map((tower) => tower.id)];
const CATEGORIES = [...new Set(props.towers.map((tower) => tower.category))];

function towersIn(category) {
  return props.towers.filter((tower) => tower.category === category);
}

// A switch that stands a tower on the mat or takes it away, category tabs, and a page of the viewed category's
// towers as pictures. With the switch off the picker stays where it was, dimmed; turning it back on stands the
// tower chosen last on this visit, or else the first one on screen.
export default function TowerPicker({ tower, setTower }) {
  const chosen = props.towers.find((t) => t.id === tower);
  const [last, setLast] = useState(chosen);
  const [viewing, setViewing] = useState(chosen?.category ?? CATEGORIES[0]);
  const [page, setPage] = useState(() => pageOf(towersIn(viewing), tower));
  const towers = towersIn(viewing);

  function choose(id) {
    setTower(id);
    setLast(props.towers.find((t) => t.id === id));
  }

  function view(category) {
    setViewing(category);
    setPage(0);
    choose(towersIn(category)[0].id);
  }

  return (
    <div className="setting">
      <div className="setting-head">
        <h3>Dice tower</h3>
        <label className="check">
          <input
            type="checkbox"
            role="switch"
            checked={Boolean(chosen)}
            onChange={(event) => setTower(event.target.checked ? (last ?? towers[0]).id : NO_TOWER)}
          />
          Tower
        </label>
      </div>
      <div className={`tower-picker${chosen ? "" : " idle"}`} inert={!chosen}>
        <Segmented
          name="tower-category"
          label="Tower category"
          options={CATEGORIES.map((c) => ({ id: c, label: c }))}
          value={viewing}
          onChange={view}
        />
        <PagedGrid
          name="tower"
          label="Dice tower"
          items={towers.map((t) => ({ id: t.id, label: t.label, image: `${import.meta.env.BASE_URL}towers/thumbs/${t.id}.webp` }))}
          page={page}
          setPage={setPage}
          value={tower}
          onChange={choose}
        >
          <p className="picker-name">{chosen ? chosen.label : "No tower"}</p>
        </PagedGrid>
      </div>
    </div>
  );
}

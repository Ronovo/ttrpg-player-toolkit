import { useState } from "react";
import props from "../dice3d/props.json";
import PagedGrid from "./PagedGrid.jsx";

export const NO_TOWER = "none";
export const TOWER_IDS = [NO_TOWER, ...props.towers.map((tower) => tower.id)];
const TOWERS_PER_PAGE = 10;

// A switch that stands a tower on the mat or takes it away, and the towers as pictures. With the switch off the
// picker stays where it was, dimmed; turning it back on stands the tower chosen last on this visit, or else the
// first one.
export default function TowerPicker({ tower, setTower }) {
  const chosen = props.towers.find((t) => t.id === tower);
  const [last, setLast] = useState(chosen);
  const [page, setPage] = useState(0);

  function choose(id) {
    setTower(id);
    setLast(props.towers.find((t) => t.id === id));
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
            onChange={(event) => setTower(event.target.checked ? (last ?? props.towers[0]).id : NO_TOWER)}
          />
          Tower
        </label>
      </div>
      <div className={`tower-picker${chosen ? "" : " idle"}`} inert={!chosen}>
        <PagedGrid
          name="tower"
          label="Dice tower"
          items={props.towers.map((t) => ({ id: t.id, label: t.label, image: `${import.meta.env.BASE_URL}towers/thumbs/${t.id}.webp` }))}
          page={page}
          setPage={setPage}
          pageSize={TOWERS_PER_PAGE}
          value={tower}
          onChange={choose}
        >
          <p className="picker-name">{chosen ? chosen.label : "No tower"}</p>
        </PagedGrid>
      </div>
    </div>
  );
}

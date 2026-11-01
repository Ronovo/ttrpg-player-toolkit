import { useState } from "react";
import props from "../dice3d/props.json";
import PagedGrid from "./PagedGrid.jsx";

export const NO_TOWER = "none";
export const TOWER_IDS = [NO_TOWER, ...props.towers.map((tower) => tower.id)];

// The towers as pictures, with the standing tower's name. `tower` is the id of a tower, never NO_TOWER.
export default function TowerPicker({ tower, setTower }) {
  const chosen = props.towers.find((t) => t.id === tower);
  const [page, setPage] = useState(0);

  return (
    <div className="tower-picker">
      <PagedGrid
        name="tower"
        label="Dice tower"
        items={props.towers.map((t) => ({ id: t.id, label: t.label, image: `${import.meta.env.BASE_URL}towers/thumbs/${t.id}.webp` }))}
        page={page}
        setPage={setPage}
        value={tower}
        onChange={setTower}
      >
        <p className="picker-name">{chosen.label}</p>
      </PagedGrid>
    </div>
  );
}

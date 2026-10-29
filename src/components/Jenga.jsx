import { useMemo, useState } from "react";
import useStoredState from "../hooks/useStoredState.js";
import { TENSIONS, condition, leanAmount, newTower, pull } from "../lib/jenga.js";

export default function Jenga() {
  const [saved, setSaved] = useStoredState("ttrpg-toolkit-jenga", "");
  const [tension, setTension] = useState(TENSIONS[1].id);
  const tower = useMemo(() => (saved ? JSON.parse(saved) : newTower(tension)), [saved, tension]);
  const started = tower.pulls > 0;

  return (
    <section className="panel jenga">
      <h2>Jenga</h2>
      <div className="jenga-layout">
        <div className="jenga-controls">
          <label>
            Tension
            <select value={tower.tension} disabled={started} onChange={(event) => setTension(event.target.value)}>
              {TENSIONS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="buttons">
            <button type="button" disabled={tower.fallen} onClick={() => setSaved(JSON.stringify(pull(tower)))}>
              Pull
            </button>
            {started && (
              <button type="button" onClick={() => setSaved("")}>Start Over</button>
            )}
          </div>
          <p className="jenga-status" aria-live="polite">
            <span>Pulls: {tower.pulls}</span>
            <span className={tower.fallen ? "jenga-fell" : undefined}>
              {tower.fallen ? "The tower fell!" : condition(tower)}
            </span>
          </p>
        </div>
        <div className="tower-area" aria-hidden="true">
          <div
            className={`tower${tower.fallen ? " fallen" : ""}`}
            style={{ "--lean": leanAmount(tower), "--fall-side": tower.leanSide }}
          >
            {tower.levels.map((level, i) => (
              <div key={i} className={`level${i % 2 ? " crosswise" : ""}`} style={{ "--level": i }}>
                {level.map((present, slot) => (
                  <span key={slot} className={`block${present ? "" : " gone"}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

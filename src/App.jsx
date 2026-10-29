import { useLayoutEffect, useState } from "react";
import DiceRoller from "./components/DiceRoller.jsx";
import CardDrawer from "./components/CardDrawer.jsx";
import Notepad from "./components/Notepad.jsx";
import Jenga from "./components/Jenga.jsx";
import useStoredState from "./hooks/useStoredState.js";

const THEMES = [
  { id: "tabletop", label: "Tabletop" },
  { id: "parchment", label: "Parchment" },
  { id: "dark", label: "Polished Dark" },
  { id: "casino", label: "Casino" },
  { id: "eldritch", label: "Eldritch" },
  { id: "neon", label: "Neon" },
  { id: "dossier", label: "Dossier" },
  { id: "slasher", label: "Slasher" },
  { id: "field-kit", label: "Field Kit" },
  { id: "forest", label: "Forest" },
];
const THEME_IDS = THEMES.map((t) => t.id);

const TABS = [
  { id: "tools", label: "Tools" },
  { id: "jenga", label: "Jenga" },
];

export default function App() {
  const [theme, setTheme] = useStoredState("ttrpg-toolkit-theme", THEME_IDS[0], THEME_IDS);
  const [tab, setTab] = useState(TABS[0].id);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <header className="app-header">
        <h1>TTRPG Player Toolkit</h1>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <label className="theme-picker">
          Style
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </header>
      <main className="app-main" hidden={tab !== "tools"}>
        <DiceRoller />
        <Notepad />
        <CardDrawer />
      </main>
      <main className="jenga-main" hidden={tab !== "jenga"}>
        <Jenga />
      </main>
    </>
  );
}

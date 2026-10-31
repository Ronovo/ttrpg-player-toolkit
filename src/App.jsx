import { useLayoutEffect, useState } from "react";
import Home from "./components/Home.jsx";
import DiceRoller from "./components/DiceRoller.jsx";
import CardDrawer from "./components/CardDrawer.jsx";
import Notepad from "./components/Notepad.jsx";
import Jenga from "./components/Jenga.jsx";
import Icon from "./components/Icon.jsx";
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
  { id: "home", label: "Home", icon: "home" },
  { id: "dice", label: "Dice Roller", icon: "d20" },
  { id: "cards", label: "Card Drawer", icon: "cards" },
  { id: "notes", label: "Notepad", icon: "quill" },
  { id: "jenga", label: "Jenga", icon: "tower" },
];

export default function App() {
  const [theme, setTheme] = useStoredState("ttrpg-toolkit-theme", THEME_IDS[0], THEME_IDS);
  const [tab, setTab] = useState(TABS[0].id);
  const [stack, setStack] = useState(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <Icon name="d20" className="brand-mark" />
          <h1>TTRPG Player Toolkit</h1>
        </div>
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
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
        <label className="theme-picker">
          <Icon name="palette" />
          <span className="visually-hidden">Style</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </header>
      {tab === "home" && <Home stack={stack} setStack={setStack} />}
      {tab === "dice" && <DiceRoller />}
      {tab === "cards" && (
        <main className="tab-main">
          <CardDrawer stack={stack} setStack={setStack} />
        </main>
      )}
      {tab === "notes" && (
        <main className="tab-main notes-main">
          <Notepad />
        </main>
      )}
      {tab === "jenga" && (
        <main className="jenga-main">
          <Jenga />
        </main>
      )}
    </>
  );
}

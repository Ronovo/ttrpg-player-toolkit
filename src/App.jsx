import { useLayoutEffect } from "react";
import DiceRoller from "./components/DiceRoller.jsx";
import CardDrawer from "./components/CardDrawer.jsx";
import Notepad from "./components/Notepad.jsx";
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

export default function App() {
  const [storedTheme, setTheme] = useStoredState("ttrpg-toolkit-theme", THEMES[0].id);
  const theme = THEMES.some((t) => t.id === storedTheme) ? storedTheme : THEMES[0].id;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <header className="app-header">
        <h1>TTRPG Player Toolkit</h1>
        <label className="theme-picker">
          Style
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </header>
      <main className="app-main">
        <DiceRoller />
        <Notepad />
        <CardDrawer />
      </main>
    </>
  );
}

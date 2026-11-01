import { useLayoutEffect, useState } from "react";
import Home from "./components/Home.jsx";
import DiceRoller from "./components/DiceRoller.jsx";
import CardDrawer from "./components/CardDrawer.jsx";
import Notepad from "./components/Notepad.jsx";
import Jenga from "./components/Jenga.jsx";
import CharacterSheet from "./components/CharacterSheet.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import Icon from "./components/Icon.jsx";
import useAccount, { AccountProvider } from "./hooks/useAccount.jsx";
import useStoredState from "./hooks/useStoredState.js";
import { TOOLS } from "./lib/tools.js";

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

const TABS = [{ id: "home", label: "Home", icon: "home" }, ...TOOLS];

export default function App() {
  return (
    <AccountProvider>
      <Toolkit />
    </AccountProvider>
  );
}

function Toolkit() {
  const { account } = useAccount();
  const [theme, setTheme] = useStoredState("ttrpg-toolkit-theme", THEME_IDS[0], THEME_IDS);
  const [tab, setTab] = useState(TABS[0].id);
  const [stack, setStack] = useState(null);
  const [toolSlot, setToolSlot] = useState(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <header className="app-header">
        <h1 className="visually-hidden">TTRPG Player Toolkit</h1>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} />
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="header-tools" ref={setToolSlot} />
        <label className="theme-picker">
          <Icon name="palette" />
          <span className="visually-hidden">Style</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <AccountMenu />
      </header>
      {account.loginError && <p className="login-error" role="alert">{account.loginError}</p>}
      {tab === "home" && <Home stack={stack} setStack={setStack} toolSlot={toolSlot} />}
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
      {tab === "sheet" && (
        <main className="tab-main">
          <CharacterSheet />
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

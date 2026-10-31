import CardDrawer from "./CardDrawer.jsx";
import Notepad from "./Notepad.jsx";
import QuickRoller from "./QuickRoller.jsx";

// Every tool on one screen. Until a deck is built it fits the window on desktop; after that the page scrolls.
export default function Home({ stack, setStack }) {
  return (
    <main className={stack ? "home" : "home fit"}>
      <div className="home-top">
        <QuickRoller />
        <Notepad />
      </div>
      <CardDrawer stack={stack} setStack={setStack} />
    </main>
  );
}

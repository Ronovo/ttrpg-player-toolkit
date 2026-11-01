import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import usePointerDrag from "../hooks/usePointerDrag.js";
import useStoredState from "../hooks/useStoredState.js";
import {
  addWindow, bottomOf, bringToFront, measuredLayout, moved, readLayout, removeWindow, replaceWindow, resized,
} from "../lib/homeLayout.js";
import { TOOLS } from "../lib/tools.js";
import CardDrawer from "./CardDrawer.jsx";
import CharacterSheet from "./CharacterSheet.jsx";
import Confirm from "./Confirm.jsx";
import Icon from "./Icon.jsx";
import Jenga from "./Jenga.jsx";
import Notepad from "./Notepad.jsx";
import QuickRoller from "./QuickRoller.jsx";

const LAYOUT_KEY = "ttrpg-toolkit-home-canvas";
// The tools of the default Home, in the order its markup shows them.
const DEFAULT_TOOLS = ["dice", "notes", "cards"];
// An arrow key moves or resizes a window by this many pixels.
const KEY_STEP = 16;
const KEY_MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

const VIEWS = {
  dice: () => <QuickRoller />,
  cards: ({ stack, setStack }) => <CardDrawer stack={stack} setStack={setStack} />,
  notes: () => <Notepad />,
  sheet: () => <CharacterSheet />,
  jenga: () => <Jenga />,
};

// One tool on the canvas. While editing, a cover over the tool takes the drags and keys: dragging it moves the
// window, dragging its corner grip resizes it, and the tool underneath ignores the pointer.
function HomeWindow({ item, tool, order, editing, canvasWidth, onChange, onFront, onRemove, children }) {
  const moveDrag = usePointerDrag(() => item, (from, dx, dy) => onChange(moved(from, dx, dy, canvasWidth())));
  const sizeDrag = usePointerDrag(() => item, (from, dx, dy) => onChange(resized(from, dx, dy, canvasWidth())));

  function nudge(event) {
    const step = KEY_MOVES[event.key];
    if (!step) return;
    event.preventDefault();
    const [dx, dy] = step.map((part) => part * KEY_STEP);
    onChange((event.shiftKey ? resized : moved)(item, dx, dy, canvasWidth()));
  }

  return (
    <div
      className="home-window"
      data-tool={item.tool}
      style={{
        "--x": item.x, "--y": `${item.y}px`, "--w": item.width, "--h": `${item.height}px`, "--order": order, zIndex: item.z,
      }}
      onPointerDownCapture={onFront}
    >
      <div className="window-body" inert={editing}>{children}</div>
      {editing && (
        <div
          className="window-cover"
          tabIndex={0}
          aria-label={`${tool.label}: drag or use the arrow keys to move it, Shift and the arrow keys to resize it`}
          onKeyDown={nudge}
          {...moveDrag}
        >
          <span className="window-name"><Icon name={tool.icon} />{tool.label}</span>
          <button type="button" className="secondary" onPointerDown={(event) => event.stopPropagation()} onClick={onRemove}>
            Remove
          </button>
          <span
            className="window-grip"
            aria-hidden="true"
            {...sizeDrag}
            onPointerDown={(event) => {
              event.stopPropagation();
              sizeDrag.onPointerDown(event);
            }}
          />
        </div>
      )}
    </div>
  );
}

// Home starts as the dice roller and notepad side by side with the card drawer below, fitting the window on a desktop
// until a deck is built. Edit layout turns it into a canvas the player arranges: any of the tools, each in a window
// that can be moved, resized and stacked. A changed layout is kept in this browser. The controls go in `toolSlot`.
export default function Home({ stack, setStack, toolSlot }) {
  const [saved, setSaved] = useStoredState(LAYOUT_KEY, "");
  const stored = useMemo(() => readLayout(saved), [saved]);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const main = useRef(null);
  const canvas = useRef(null);
  const layout = stored ?? draft;

  function save(next) {
    if (next !== layout) setSaved(JSON.stringify(next));
  }

  // The default Home is measured as it stands, so the canvas opens with every tool exactly where it was.
  function startEditing() {
    if (!stored) {
      const top = main.current.querySelector(".home-top");
      const tools = [...main.current.querySelectorAll(":scope > .home-top > *, :scope > .home-top + *")].map(
        (element, index) => ({ tool: DEFAULT_TOOLS[index], rect: element.getBoundingClientRect() }));
      setDraft(measuredLayout(top.getBoundingClientRect(), tools, parseFloat(getComputedStyle(top).rowGap) || 0));
    }
    setEditing(true);
  }

  function finish() {
    setEditing(false);
    setResetting(false);
    setDraft(null);
  }

  const controls = editing ? (
    <div className="home-controls editing">
      {layout.length < TOOLS.length && (
        <label>
          <span className="visually-hidden">Add tool</span>
          <select value="" onChange={(event) => save(addWindow(layout, event.target.value))}>
            <option value="" disabled>Add tool</option>
            {TOOLS.filter((tool) => !layout.some((item) => item.tool === tool.id)).map((tool) => (
              <option key={tool.id} value={tool.id}>{tool.label}</option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="secondary" onClick={() => setResetting(true)}>Reset to default</button>
      <button type="button" onClick={finish}>Done</button>
    </div>
  ) : (
    <div className="home-controls">
      <button type="button" className="secondary" aria-label="Edit layout" title="Edit layout" onClick={startEditing}>
        <Icon name="layout" />
      </button>
    </div>
  );

  if (!layout) {
    return (
      <main className={stack ? "home" : "home fit"} ref={main}>
        {toolSlot && createPortal(controls, toolSlot)}
        <div className="home-top">
          <QuickRoller />
          <Notepad />
        </div>
        <CardDrawer stack={stack} setStack={setStack} />
      </main>
    );
  }

  const order = [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map((item) => item.tool);

  return (
    <main className="home">
      {toolSlot && createPortal(controls, toolSlot)}
      {resetting && (
        <Confirm
          text="Put Home back to the default layout? Your arrangement is replaced."
          yes="Reset"
          no="Keep mine"
          onYes={() => {
            setSaved("");
            finish();
          }}
          onNo={() => setResetting(false)}
        />
      )}
      {layout.length === 0 && <p className="form-note">Home is empty. Use Edit layout to add tools.</p>}
      <div
        className={editing ? "home-canvas editing" : "home-canvas"}
        ref={canvas}
        style={{ "--canvas-height": `${bottomOf(layout)}px` }}
      >
        {layout.map((item) => {
          const View = VIEWS[item.tool];
          return (
            <HomeWindow
              key={item.tool}
              item={item}
              tool={TOOLS.find((tool) => tool.id === item.tool)}
              order={order.indexOf(item.tool)}
              editing={editing}
              canvasWidth={() => canvas.current.getBoundingClientRect().width}
              onChange={(changed) => save(replaceWindow(layout, changed))}
              onFront={() => (stored ? save : setDraft)(bringToFront(layout, item.tool))}
              onRemove={() => save(removeWindow(layout, item.tool))}
            >
              <View stack={stack} setStack={setStack} />
            </HomeWindow>
          );
        })}
      </div>
    </main>
  );
}

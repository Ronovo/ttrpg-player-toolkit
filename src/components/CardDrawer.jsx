import { useState } from "react";
import { addDeck, createStack } from "../lib/cards.js";
import Pile from "./Pile.jsx";

export default function CardDrawer() {
  const [type, setType] = useState("playing");
  const [deckCount, setDeckCount] = useState("1");
  const [includeJokers, setIncludeJokers] = useState(false);
  const [splitArcana, setSplitArcana] = useState(false);
  const [stack, setStack] = useState(null);
  const isTarot = type === "tarot";

  function handleBuild(event) {
    event.preventDefault();
    setStack(createStack(type, Number(deckCount), includeJokers, splitArcana));
  }

  function updatePile(index, action) {
    setStack((current) => ({
      ...current,
      piles: current.piles.map((pile, i) => (i === index ? action(pile) : pile)),
    }));
  }

  return (
    <section className="panel card-drawer">
      <h2>Card Drawer</h2>
      <form className="controls" onSubmit={handleBuild}>
        <label>
          Deck
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="playing">Playing Cards</option>
            <option value="tarot">Tarot</option>
          </select>
        </label>
        <label>
          Decks
          <input
            type="number"
            min="1"
            required
            value={deckCount}
            onChange={(event) => setDeckCount(event.target.value)}
          />
        </label>
        {isTarot ? (
          <label className="check">
            <input
              type="checkbox"
              checked={splitArcana}
              onChange={(event) => setSplitArcana(event.target.checked)}
            />
            Split Major/Minor Arcana
          </label>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={includeJokers}
              onChange={(event) => setIncludeJokers(event.target.checked)}
            />
            Include Jokers
          </label>
        )}
        <button type="submit">Build Deck</button>
      </form>

      {stack && (
        <>
          <div className="stack-header">
            <span>
              {stack.deckCount} {stack.type === "tarot" ? "tarot" : "playing card"} deck
              {stack.deckCount === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={() => setStack(addDeck)}>Add Deck</button>
          </div>
          <div className="piles">
            {stack.piles.map((pile, i) => (
              <Pile
                key={pile.name}
                pile={pile}
                type={stack.type}
                onAction={(action) => updatePile(i, action)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

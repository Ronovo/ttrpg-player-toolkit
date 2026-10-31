import { useState } from "react";
import { addDeck, createStack } from "../lib/cards.js";
import useStoredState from "../hooks/useStoredState.js";
import Pile from "./Pile.jsx";
import Icon from "./Icon.jsx";
import ImageUpload from "./ImageUpload.jsx";

const CARD_BACK_SIZE = 512;

// `stack` lives in App, so Home and the Card Drawer tab share one deck.
export default function CardDrawer({ stack, setStack }) {
  const [type, setType] = useState("playing");
  const [deckCount, setDeckCount] = useState("1");
  const [includeJokers, setIncludeJokers] = useState(false);
  const [splitArcana, setSplitArcana] = useState(false);
  const [cardBack, setCardBack] = useStoredState("ttrpg-toolkit-card-back", "");
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
      <h2><Icon name="cards" />Card Drawer</h2>
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
              role="switch"
              checked={splitArcana}
              onChange={(event) => setSplitArcana(event.target.checked)}
            />
            Split Major/Minor Arcana
          </label>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              role="switch"
              checked={includeJokers}
              onChange={(event) => setIncludeJokers(event.target.checked)}
            />
            Include Jokers
          </label>
        )}
        <button type="submit">Build Deck</button>
        <ImageUpload label="Card back" maxSize={CARD_BACK_SIZE} onChange={setCardBack} />
        {cardBack && (
          <button type="button" className="secondary" onClick={() => setCardBack("")}>Reset back</button>
        )}
      </form>

      {stack && (
        <>
          <div className="stack-header">
            <span>
              {stack.deckCount} {stack.type === "tarot" ? "tarot" : "playing card"} deck
              {stack.deckCount === 1 ? "" : "s"}
            </span>
            <button type="button" className="secondary" onClick={() => setStack(addDeck)}>Add Deck</button>
          </div>
          <div className="piles">
            {stack.piles.map((pile, i) => (
              <Pile
                key={pile.name}
                pile={pile}
                type={stack.type}
                cardBack={cardBack}
                onAction={(action) => updatePile(i, action)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

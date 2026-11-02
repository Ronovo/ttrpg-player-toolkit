import { useState } from "react";
import { CARD_ASPECTS, createStack } from "../lib/cards.js";
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
  const [playingBack, setPlayingBack] = useStoredState("ttrpg-toolkit-card-back", "");
  const [tarotBack, setTarotBack] = useStoredState("ttrpg-toolkit-tarot-back", "");
  const backs = { playing: [playingBack, setPlayingBack], tarot: [tarotBack, setTarotBack] };
  const [cardBack, setCardBack] = backs[type];
  const isTarot = type === "tarot";
  const backName = isTarot ? "Tarot back" : "Playing card back";

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
        <div className="controls-aside">
          <ImageUpload
            label={backName}
            maxSize={CARD_BACK_SIZE}
            aspect={CARD_ASPECTS[type]}
            fitHint={`a ${backName.toLowerCase()}`}
            onChange={setCardBack}
          />
          {cardBack && (
            <button type="button" className="secondary" onClick={() => setCardBack("")}>Reset back</button>
          )}
        </div>
      </form>

      {stack && (
        <>
          <div className="stack-header">
            <span>
              {stack.deckCount} {stack.type === "tarot" ? "tarot" : "playing card"} deck
              {stack.deckCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="piles">
            {stack.piles.map((pile, i) => (
              <Pile
                key={pile.name}
                pile={pile}
                type={stack.type}
                cardBack={backs[stack.type][0]}
                onAction={(action) => updatePile(i, action)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

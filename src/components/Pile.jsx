import { CARD_ASPECTS, discardDrawn, drawCard, shuffleDiscardIn, shufflePile } from "../lib/cards.js";
import Card from "./Card.jsx";
import CardBack from "./CardBack.jsx";

const PILE_BUTTONS = [
  { label: "Draw", enabled: (pile) => pile.drawPile.length > 0, run: drawCard },
  { label: "Shuffle", secondary: true, enabled: (pile) => pile.drawPile.length > 1, run: shufflePile },
  { label: "Discard", secondary: true, enabled: (pile) => pile.drawn.length > 0, run: discardDrawn },
  { label: "Shuffle Discard In", secondary: true, enabled: (pile) => pile.discard.length > 0, run: shuffleDiscardIn },
];
// The face-down deck gets one pixel thicker for every this many cards, up to MAX_DECK_DEPTH.
const CARDS_PER_PIXEL = 8;
const MAX_DECK_DEPTH = 8;

export default function Pile({ pile, type, cardBack, onAction }) {
  const canReverse = type === "tarot";
  const left = pile.drawPile.length;
  return (
    <div className={`pile ${type}`} style={{ "--card-aspect": CARD_ASPECTS[type] }}>
      <h3>{pile.name}</h3>
      <p className="counts">
        <span className="chip">Draw pile: {left}</span>
        <span className="chip">Discard: {pile.discard.length}</span>
      </p>
      <div className="buttons">
        {PILE_BUTTONS.map((button) => (
          <button
            key={button.label}
            type="button"
            className={button.secondary ? "secondary" : undefined}
            disabled={!button.enabled(pile)}
            onClick={() => onAction((current) => button.run(current, canReverse))}
          >
            {button.label}
          </button>
        ))}
      </div>
      <div className="pile-table">
        <button
          type="button"
          className="deck"
          disabled={!left}
          aria-label={`Draw from ${pile.name}`}
          style={{ "--depth": `${Math.min(MAX_DECK_DEPTH, Math.ceil(left / CARDS_PER_PIXEL))}px` }}
          onClick={() => onAction((current) => drawCard(current, canReverse))}
        >
          {left > 0 && <CardBack image={cardBack} />}
          <span className="chip deck-count">{left}</span>
        </button>
        <ol className="drawn">
          {pile.drawn.map((entry, i) => (
            <Card key={i} entry={entry} />
          ))}
        </ol>
      </div>
    </div>
  );
}

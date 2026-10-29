import { discardDrawn, drawCard, shuffleDiscardIn, shufflePile } from "../lib/cards.js";
import Card from "./Card.jsx";

const PILE_BUTTONS = [
  { label: "Draw", enabled: (pile) => pile.drawPile.length > 0, run: drawCard },
  { label: "Shuffle", enabled: (pile) => pile.drawPile.length > 1, run: shufflePile },
  { label: "Discard", enabled: (pile) => pile.drawn.length > 0, run: discardDrawn },
  { label: "Shuffle Discard In", enabled: (pile) => pile.discard.length > 0, run: shuffleDiscardIn },
];

export default function Pile({ pile, type, onAction }) {
  const canReverse = type === "tarot";
  return (
    <div className={`pile ${type}`}>
      <h3>{pile.name}</h3>
      <p className="counts">
        Draw pile: {pile.drawPile.length} | Discard: {pile.discard.length}
      </p>
      <div className="buttons">
        {PILE_BUTTONS.map((button) => (
          <button
            key={button.label}
            type="button"
            disabled={!button.enabled(pile)}
            onClick={() => onAction((current) => button.run(current, canReverse))}
          >
            {button.label}
          </button>
        ))}
      </div>
      <ol className="drawn">
        {pile.drawn.map((entry, i) => (
          <Card key={i} entry={entry} />
        ))}
      </ol>
    </div>
  );
}

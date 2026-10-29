import * as playingCards from "@letele/playing-cards";

export default function Card({ entry }) {
  const { card, reversed } = entry;
  const Face = card.face && playingCards[card.face];
  const name = reversed ? `${card.name} (Reversed)` : card.name;

  return (
    <li className={`card ${Face ? "playing" : "tarot"}${reversed ? " reversed" : ""}`}>
      <div className="card-image">
        {Face ? (
          <Face className="card-face" role="img" aria-label={name} />
        ) : (
          <img className="card-face" src={card.image} alt={name} />
        )}
      </div>
      <span className="card-name">{name}</span>
    </li>
  );
}

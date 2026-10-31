import Icon from "./Icon.jsx";

// The back of a card: the uploaded `image`, or a pattern in the page style's colors.
export default function CardBack({ image }) {
  return image ? (
    <img className="card-back" src={image} alt="" />
  ) : (
    <span className="card-back themed">
      <Icon name="d20" />
    </span>
  );
}

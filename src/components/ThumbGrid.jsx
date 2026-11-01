import Icon from "./Icon.jsx";

// A radio group of pictures, such as dice sets or towers. An option without an image shows a plain die and
// its label.
// `fill` pads the grid with empty cells up to that many, so every page of a paged grid is the same height.
export default function ThumbGrid({ name, label, options, value, onChange, fill = 0 }) {
  return (
    <div className="thumb-grid" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.id} className="thumb-option" title={option.label}>
          <input
            type="radio"
            name={name}
            className="visually-hidden"
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          {option.image ? (
            <img src={option.image} alt={option.label} />
          ) : (
            <span className="thumb-generic">
              <Icon name="d20" />
              {option.label}
            </span>
          )}
        </label>
      ))}
      {Array.from({ length: Math.max(0, fill - options.length) }, (_, i) => (
        <span key={`empty-${i}`} className="thumb-empty" aria-hidden="true" />
      ))}
    </div>
  );
}

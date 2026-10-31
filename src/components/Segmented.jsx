// A row of pill-shaped radio buttons. `options` is a list of { id, label }.
export default function Segmented({ name, label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.id}>
          <input
            type="radio"
            name={name}
            className="visually-hidden"
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

// A question asked in the page instead of a browser dialog.
export default function Confirm({ text, yes, no, onYes, onNo }) {
  return (
    <div className="confirm" role="group" aria-label={text}>
      <p>{text}</p>
      <button type="button" onClick={onYes}>{yes}</button>
      <button type="button" className="secondary" onClick={onNo}>{no}</button>
    </div>
  );
}

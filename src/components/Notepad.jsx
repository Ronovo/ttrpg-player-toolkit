import useStoredState from "../hooks/useStoredState.js";
import Icon from "./Icon.jsx";

export default function Notepad() {
  const [notes, setNotes] = useStoredState("ttrpg-toolkit-notes", "");

  return (
    <section className="panel notepad">
      <h2><Icon name="quill" />Notepad</h2>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Session notes, NPC names, loot..."
        aria-label="Notes"
      />
    </section>
  );
}

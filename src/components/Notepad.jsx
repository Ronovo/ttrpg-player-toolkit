import useStoredState from "../hooks/useStoredState.js";

export default function Notepad() {
  const [notes, setNotes] = useStoredState("ttrpg-toolkit-notes", "");

  return (
    <section className="panel notepad">
      <h2>Notepad</h2>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Session notes, NPC names, loot..."
        aria-label="Notes"
      />
    </section>
  );
}

import { useState } from "react";
import useAccount from "../hooks/useAccount.jsx";
import Icon from "./Icon.jsx";
import ImageUpload from "./ImageUpload.jsx";

const THUMBNAIL_SIZE = 256;
const MAX_LABEL = 40;

// Uploading a dice set: a name, a .glb exported from Blender and, if you like, a screenshot. Lists the
// account's sets with a Delete for each. Shows nothing while logged out.
export default function MyDice() {
  const { account, customSets, uploadSet, deleteSet } = useAccount();
  const [label, setLabel] = useState("");
  const [model, setModel] = useState(null);
  const [screenshot, setScreenshot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!account.username) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData();
    form.append("label", label);
    form.append("model", model);
    if (screenshot) form.append("thumbnail", screenshot);
    setBusy(true);
    setError("");
    try {
      await uploadSet(form);
      setLabel("");
      setModel(null);
      setScreenshot("");
      setAttempt(attempt + 1);
    } catch (failure) {
      setError(failure.message);
    }
    setBusy(false);
  }

  function remove(id) {
    deleteSet(id).catch((failure) => setError(failure.message));
  }

  return (
    <div className="my-dice">
      <h3>My Dice</h3>
      <form key={attempt} className="controls" onSubmit={handleSubmit}>
        <label>
          Name
          <input type="text" required maxLength={MAX_LABEL} value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label className="file-button">
          <Icon name="upload" />
          {model ? model.name : "Model (.glb)"}
          <input type="file" accept=".glb" className="visually-hidden" onChange={(event) => setModel(event.target.files[0] ?? null)} />
        </label>
        <ImageUpload label={screenshot ? "Screenshot added" : "Screenshot"} maxSize={THUMBNAIL_SIZE} onChange={setScreenshot} />
        <button type="submit" disabled={busy || !model}>Upload</button>
      </form>
      <p className="form-note">
        Seven dice named d4 to d100, built from the toolkit's dice models. Without a screenshot the set shows a plain die.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {customSets.length > 0 && (
        <ul className="my-sets">
          {customSets.map((set) => (
            <li key={set.id}>
              <span>{set.label}</span>
              <button type="button" className="secondary" onClick={() => remove(set.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

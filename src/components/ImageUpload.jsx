import { fileToDataUrl } from "../lib/images.js";
import Icon from "./Icon.jsx";

export default function ImageUpload({ label, maxSize, onChange }) {
  async function handleChange(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) onChange(await fileToDataUrl(file, maxSize));
  }

  return (
    <label className="file-button">
      <Icon name="upload" />
      {label}
      <input type="file" accept="image/*" className="visually-hidden" onChange={handleChange} />
    </label>
  );
}

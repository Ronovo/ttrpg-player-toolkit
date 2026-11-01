import { useState } from "react";
import { closePicture, cropToDataUrl, fileToDataUrl, readPicture } from "../lib/images.js";
import Icon from "./Icon.jsx";
import ImageCrop from "./ImageCrop.jsx";

// A button that takes a picture. With an `aspect` it opens the crop window first; without one it keeps the whole
// picture. Either way it is shrunk to `maxSize` pixels on its longer side.
export default function ImageUpload({ label, maxSize, onChange, aspect, fitHint }) {
  const [picture, setPicture] = useState(null);

  async function handleChange(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    if (aspect) setPicture(await readPicture(file));
    else onChange(await fileToDataUrl(file, maxSize));
  }

  function finish(crop) {
    if (crop) onChange(cropToDataUrl(picture.bitmap, crop, maxSize));
    closePicture(picture);
    setPicture(null);
  }

  return (
    <>
      <label className="file-button">
        <Icon name="upload" />
        {label}
        <input type="file" accept="image/*" className="visually-hidden" onChange={handleChange} />
      </label>
      {picture && (
        <ImageCrop
          picture={picture}
          aspect={aspect}
          title={label}
          fitHint={fitHint}
          maxSize={maxSize}
          onUse={finish}
          onCancel={() => finish(null)}
        />
      )}
    </>
  );
}

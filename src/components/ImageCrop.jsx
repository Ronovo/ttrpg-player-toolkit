import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import usePointerDrag from "../hooks/usePointerDrag.js";
import { fitSize, largestCrop } from "../lib/images.js";

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.05;
// An arrow key moves the frame by this share of its own size.
const NUDGE = 0.05;
// Shapes this close count as the same, so rounding never makes a picture look cut off.
const SAME_SHAPE = 0.01;
const KEY_MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

// Shows `picture` with a frame of `aspect` over it. The frame starts as large as it can be, and `zoom` shrinks it;
// it is dragged or moved with the arrow keys and always stays inside the picture. With `fitHint` set, a picture
// whose shape does not match is told what size would fit without cropping.
export default function ImageCrop({ picture, aspect, title, fitHint, maxSize, onUse, onCancel }) {
  const { width, height } = picture;
  const largest = largestCrop(width, height, aspect);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: width / 2, y: height / 2 });
  const stage = useRef(null);

  const cropWidth = largest.width / zoom;
  const cropHeight = largest.height / zoom;
  const crop = {
    x: clamp(center.x - cropWidth / 2, 0, width - cropWidth),
    y: clamp(center.y - cropHeight / 2, 0, height - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
  const cutOff = Math.abs(width / height - aspect) / aspect > SAME_SHAPE;
  const fit = fitSize(aspect, maxSize);

  function moveTo(x, y) {
    setCenter({ x: clamp(x, cropWidth / 2, width - cropWidth / 2), y: clamp(y, cropHeight / 2, height - cropHeight / 2) });
  }

  const drag = usePointerDrag(
    () => ({ x: crop.x + cropWidth / 2, y: crop.y + cropHeight / 2, scale: width / stage.current.getBoundingClientRect().width }),
    (from, dx, dy) => moveTo(from.x + dx * from.scale, from.y + dy * from.scale),
  );

  function nudge(event) {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    moveTo(crop.x + cropWidth / 2 + move[0] * cropWidth * NUDGE, crop.y + cropHeight / 2 + move[1] * cropHeight * NUDGE);
  }

  return createPortal(
    <div className="crop-overlay" onKeyDown={(event) => event.key === "Escape" && onCancel()}>
      <div className="panel crop-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div className="crop-stage" ref={stage} style={{ aspectRatio: `${width} / ${height}` }}>
          <img src={picture.url} alt="" draggable={false} />
          <div
            className="crop-frame"
            tabIndex={0}
            aria-label="Crop area"
            style={{
              left: `${(crop.x / width) * 100}%`,
              top: `${(crop.y / height) * 100}%`,
              width: `${(cropWidth / width) * 100}%`,
              height: `${(cropHeight / height) * 100}%`,
            }}
            {...drag}
            onKeyDown={nudge}
          />
        </div>
        <p className="form-note">Drag the frame or move it with the arrow keys. Zoom in to crop closer.</p>
        {fitHint && cutOff && (
          <p className="crop-hint">
            This picture is cut to fit {fitHint}. A {fit.width} × {fit.height} picture, or any in that shape, fits without
            cropping.
          </p>
        )}
        <label className="crop-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="crop-buttons">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={() => onUse(crop)}>Use picture</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

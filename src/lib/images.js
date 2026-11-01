// The largest rectangle of `aspect` (width / height) that fits inside a picture this size.
export function largestCrop(width, height, aspect) {
  const cropWidth = Math.min(width, height * aspect);
  return { width: cropWidth, height: cropWidth / aspect };
}

// The picture size, in whole pixels, that fills an `aspect` shape saved at `maxSize` on its longer side.
export function fitSize(aspect, maxSize) {
  return aspect < 1
    ? { width: Math.round(maxSize * aspect), height: maxSize }
    : { width: maxSize, height: Math.round(maxSize / aspect) };
}

// A picture to crop: its pixels, its size and an address the page can show it from. Free it with closePicture.
export async function readPicture(file) {
  const bitmap = await createImageBitmap(file);
  return { bitmap, width: bitmap.width, height: bitmap.height, url: URL.createObjectURL(file) };
}

export function closePicture({ bitmap, url }) {
  bitmap.close();
  URL.revokeObjectURL(url);
}

// Cuts `crop` ({ x, y, width, height } in the picture's pixels) out of a picture, shrinks it to at most
// `maxSize` pixels on its longer side and returns it as a WebP data URL, small enough to keep in localStorage.
export function cropToDataUrl(bitmap, crop, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  canvas.getContext("2d").drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.85);
}

// The whole picture, shrunk the same way.
export async function fileToDataUrl(file, maxSize) {
  const bitmap = await createImageBitmap(file);
  const url = cropToDataUrl(bitmap, { x: 0, y: 0, width: bitmap.width, height: bitmap.height }, maxSize);
  bitmap.close();
  return url;
}

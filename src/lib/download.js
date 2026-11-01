// Hands `bytes` to the browser as a file called `name`. The browser saves it to its downloads folder, or asks
// where to put it if it is set to ask.
export function downloadFile(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

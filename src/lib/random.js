// Returns an integer from 0 to max - 1. Values at or above `limit` are re-drawn
// so every result is equally likely (plain modulo would favor low numbers).
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function randomFraction() {
  return randomInt(1_000_000) / 1_000_000;
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const PLAYING_SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"];
const PLAYING_RANKS = [
  ["a", "Ace"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"],
  ["8", "8"], ["9", "9"], ["10", "10"], ["j", "Jack"], ["q", "Queen"], ["k", "King"],
];

const TAROT_MAJOR = [
  "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
  "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
  "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
  "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
];
const TAROT_SUITS = ["Wands", "Cups", "Swords", "Pentacles"];
const TAROT_RANKS = [
  ["01", "Ace"], ["02", "Two"], ["03", "Three"], ["04", "Four"], ["05", "Five"],
  ["06", "Six"], ["07", "Seven"], ["08", "Eight"], ["09", "Nine"], ["10", "Ten"],
  ["page", "Page"], ["knight", "Knight"], ["queen", "Queen"], ["king", "King"],
];

function tarotCard(id, name, arcana) {
  return { id, name, arcana, image: `/cards/tarot/${id}.jpg` };
}

// `face` is the component name exported by @letele/playing-cards.
export function buildPlayingDeck(includeJokers) {
  const cards = [];
  for (const suit of PLAYING_SUITS) {
    for (const [rankId, rankName] of PLAYING_RANKS) {
      cards.push({
        id: `playing-${suit.toLowerCase()}-${rankId}`,
        name: `${rankName} of ${suit}`,
        face: `${suit[0]}${rankId}`,
      });
    }
  }
  if (includeJokers) {
    cards.push({ id: "playing-joker-red", name: "Red Joker", face: "J1" });
    cards.push({ id: "playing-joker-black", name: "Black Joker", face: "J2" });
  }
  return cards;
}

export function buildTarotDeck() {
  const cards = TAROT_MAJOR.map((name, number) =>
    tarotCard(`tarot-major-${String(number).padStart(2, "0")}`, name, "major"),
  );
  for (const suit of TAROT_SUITS) {
    for (const [rankId, rankName] of TAROT_RANKS) {
      cards.push(tarotCard(`tarot-${suit.toLowerCase()}-${rankId}`, `${rankName} of ${suit}`, "minor"));
    }
  }
  return cards;
}

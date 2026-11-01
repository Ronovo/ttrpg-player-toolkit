import diceData from "../dice3d/dice.json";

export const DICE_SETS = diceData.sets;
export const FAVORITES = "Favorites";
export const MY_DICE = "My Dice";
// Uploaded sets roll like the first built-in set.
const CUSTOM_PHYSICS = { mass: DICE_SETS[0].mass, restitution: DICE_SETS[0].restitution };

// The built-in sets followed by the account's own uploads, which make up the My Dice category.
export function allSets(customSets) {
  return [...DICE_SETS, ...customSets.map((set) => ({ ...CUSTOM_PHYSICS, ...set, category: MY_DICE, custom: true }))];
}

export function categoriesOf(sets) {
  return [...new Set(sets.map((set) => set.category))];
}

// The sets in a category; Favorites holds the starred ones, in the usual set order.
export function setsIn(sets, category, favorites) {
  return sets.filter((set) => (category === FAVORITES ? favorites.includes(set.id) : set.category === category));
}

export function modelUrl(set) {
  return set.custom ? `/api/dice/${set.id}.glb` : `${import.meta.env.BASE_URL}dice/${set.id}.glb`;
}

// Where a set's picture is, or null for an upload without a screenshot.
export function thumbnailUrl(set) {
  if (!set.custom) return `${import.meta.env.BASE_URL}dice/thumbs/${set.id}.webp`;
  return set.thumbnail ? `/api/dice/${set.id}/thumb` : null;
}

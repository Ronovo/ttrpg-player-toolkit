import { useState } from "react";
import { useDiceSets, useFavorites } from "../hooks/useDiceRoll.js";
import { FAVORITES, categoriesOf, setsIn, thumbnailUrl } from "../lib/diceSets.js";
import Icon from "./Icon.jsx";
import PagedGrid, { pageOf } from "./PagedGrid.jsx";
import Segmented from "./Segmented.jsx";

// Category tabs, a page of the viewed category's sets as pictures, and the chosen set's name with a star that
// adds it to Favorites. The Favorites tab shows once something is starred; My Dice while the account has uploads.
export default function SetPicker({ diceSet, setDiceSet }) {
  const sets = useDiceSets();
  const [favorites, toggleFavorite] = useFavorites();
  const chosenSet = sets.find((s) => s.id === diceSet);
  const [viewing, setViewing] = useState(chosenSet.category);
  const [page, setPage] = useState(() => pageOf(setsIn(sets, chosenSet.category, favorites), diceSet));
  const categories = favorites.length ? [FAVORITES, ...categoriesOf(sets)] : categoriesOf(sets);
  const category = categories.includes(viewing) ? viewing : chosenSet.category;
  const starred = favorites.includes(diceSet);

  function view(next) {
    setViewing(next);
    setPage(0);
    setDiceSet(setsIn(sets, next, favorites)[0].id);
  }

  function star() {
    toggleFavorite(diceSet);
    if (starred && favorites.length === 1) {
      setViewing(chosenSet.category);
      setPage(pageOf(setsIn(sets, chosenSet.category, favorites), diceSet));
    }
  }

  return (
    <>
      <Segmented
        name="category"
        label="Category"
        options={categories.map((c) => ({ id: c, label: c }))}
        value={category}
        onChange={view}
      />
      <PagedGrid
        name="dice-set"
        label="Set"
        items={setsIn(sets, category, favorites).map((s) => ({ id: s.id, label: s.label, image: thumbnailUrl(s) }))}
        page={page}
        setPage={setPage}
        value={diceSet}
        onChange={setDiceSet}
      >
        <p className="picker-name">
          {chosenSet.label}
          <button
            type="button"
            className={starred ? "star starred" : "star"}
            aria-pressed={starred}
            aria-label={starred ? `Remove ${chosenSet.label} from Favorites` : `Add ${chosenSet.label} to Favorites`}
            onClick={star}
          >
            <Icon name="star" />
          </button>
        </p>
      </PagedGrid>
    </>
  );
}

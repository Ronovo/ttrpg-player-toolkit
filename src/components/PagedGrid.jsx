import Icon from "./Icon.jsx";
import ThumbGrid from "./ThumbGrid.jsx";

export const PAGE_SIZE = 10;

export function pageOf(items, id) {
  return Math.max(0, Math.floor(items.findIndex((item) => item.id === id) / PAGE_SIZE));
}

// One page of `items` as pictures, `pageSize` to a page, then a row with `children` (the chosen item's name)
// and, when the items take more than one page, arrows that turn the pages. Every page of a paged grid is padded
// to the same height.
export default function PagedGrid({ name, label, items, page, setPage, value, onChange, pageSize = PAGE_SIZE, children }) {
  const pages = Math.ceil(items.length / pageSize);
  const shown = Math.min(page, pages - 1);
  return (
    <>
      <ThumbGrid
        name={name}
        label={label}
        options={items.slice(shown * pageSize, (shown + 1) * pageSize)}
        fill={pages > 1 ? pageSize : 0}
        value={value}
        onChange={onChange}
      />
      <div className="picker-footer">
        {children}
        {pages > 1 && (
          <div className="pager">
            <button
              type="button"
              className="secondary"
              aria-label="Previous page"
              disabled={shown === 0}
              onClick={() => setPage(shown - 1)}
            >
              <Icon name="left" />
            </button>
            <span aria-live="polite">{shown + 1} / {pages}</span>
            <button
              type="button"
              className="secondary"
              aria-label="Next page"
              disabled={shown === pages - 1}
              onClick={() => setPage(shown + 1)}
            >
              <Icon name="right" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

import { useEffect, useState } from "react";

// A stored JSON value, or the fallback when it doesn't parse.
export function parseStored(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export default function useStoredState(key, initialValue, allowedValues) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initialValue;
    } catch {
      // Storage is blocked; start from the default for this visit.
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is full or blocked; the value still lasts until the page is closed.
    }
  }, [key, value]);

  const allowed = !allowedValues || allowedValues.includes(value);
  return [allowed ? value : initialValue, setValue];
}

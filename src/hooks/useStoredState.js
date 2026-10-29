import { useEffect, useState } from "react";

export default function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initialValue);

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}

import { useEffect, useState } from "react";

export default function useStoredState(key, initialValue, allowedValues) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initialValue);

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  const allowed = !allowedValues || allowedValues.includes(value);
  return [allowed ? value : initialValue, setValue];
}

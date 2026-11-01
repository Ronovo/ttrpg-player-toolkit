// Stands in for src/sheet/reader.js wherever a component loads it (see vitest.config.js), since jsdom cannot run pdf.js.
import { vi } from 'vitest';

export const openSheet = vi.fn();

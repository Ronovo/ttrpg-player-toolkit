// Stands in for src/dice3d/table.js wherever a component loads it (see vitest.config.js), since jsdom has no WebGL.
import { vi } from 'vitest';

export const prepareTable = vi.fn();
export const prepareMat = vi.fn();
export const mountMat = vi.fn();
export const setMat = vi.fn();
export const setTower = vi.fn();
export const rollOnTable = vi.fn();
export const rollOnMat = vi.fn();

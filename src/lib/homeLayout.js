import { parseStored } from "../hooks/useStoredState.js";
import { TOOLS } from "./tools.js";

// A layout is a list of windows, { tool, x, y, width, height, z }. x and width are shares of the canvas width, so a
// layout fits any screen; y and height are pixels. Overlapping windows stack by z, highest in front.

// Each tool's width and height when it is added, and the smallest it can be made, in pixels.
export const TOOL_SIZES = {
  dice: { width: 0.5, height: 460, minWidth: 320, minHeight: 260 },
  cards: { width: 1, height: 520, minWidth: 360, minHeight: 240 },
  notes: { width: 0.5, height: 460, minWidth: 220, minHeight: 160 },
  sheet: { width: 0.6, height: 680, minWidth: 360, minHeight: 320 },
  jenga: { width: 0.5, height: 600, minWidth: 320, minHeight: 360 },
};

const TOOL_IDS = TOOLS.map((tool) => tool.id);
const MIN_SHARE = 0.05;

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function isWindow(item) {
  return item && TOOL_IDS.includes(item.tool) && ["x", "y", "width", "height", "z"].every((key) => Number.isFinite(item[key]));
}

// A saved layout, or null when there is none to read. Unknown tools and second copies are dropped, and every window
// is kept inside the canvas.
export function readLayout(text) {
  const saved = parseStored(text, null);
  if (!Array.isArray(saved)) return null;
  const seen = new Set();
  return saved.filter((item) => isWindow(item) && !seen.has(item.tool) && seen.add(item.tool)).map((item) => {
    const width = clamp(item.width, MIN_SHARE, 1);
    return {
      tool: item.tool,
      x: clamp(item.x, 0, 1 - width),
      y: Math.max(0, item.y),
      width,
      height: Math.max(TOOL_SIZES[item.tool].minHeight, item.height),
      z: item.z,
    };
  });
}

// The layout that puts each tool where it was measured on screen. `area` is the box the tools sit in and `gap` the
// space between them. Every window carries half a gap of padding on each side, and the canvas reaches half a gap past
// `area`, so a tool's own box lands exactly on its measured `rect`.
export function measuredLayout(area, tools, gap) {
  const canvasWidth = area.width + gap;
  return tools.map(({ tool, rect }, index) => ({
    tool,
    x: (rect.left - area.left) / canvasWidth,
    y: Math.round(rect.top - area.top),
    width: (rect.width + gap) / canvasWidth,
    height: Math.round(rect.height + gap),
    z: index + 1,
  }));
}

export function bottomOf(layout) {
  return Math.max(0, ...layout.map((item) => item.y + item.height));
}

function topZ(layout) {
  return Math.max(0, ...layout.map((item) => item.z));
}

// The tool's window added below the others, at the left, in front.
export function addWindow(layout, tool) {
  const { width, height } = TOOL_SIZES[tool];
  return [...layout, { tool, x: 0, y: bottomOf(layout), width, height, z: topZ(layout) + 1 }];
}

export function removeWindow(layout, tool) {
  return layout.filter((item) => item.tool !== tool);
}

// The layout with a window's place and size changed. Its stacking is left as it is, since bringToFront owns that.
export function replaceWindow(layout, changed) {
  return layout.map((item) => (item.tool === changed.tool ? { ...changed, z: item.z } : item));
}

// The layout with the tool's window in front. The same layout when it already is, so nothing is saved again.
export function bringToFront(layout, tool) {
  const top = topZ(layout);
  if (layout.find((item) => item.tool === tool).z === top) return layout;
  return layout.map((item) => (item.tool === tool ? { ...item, z: top + 1 } : item));
}

// Where a window lands when dragged dx, dy pixels from `start`: inside the canvas's width and below its top.
export function moved(start, dx, dy, canvasWidth) {
  return { ...start, x: clamp(start.x + dx / canvasWidth, 0, 1 - start.width), y: Math.max(0, start.y + dy) };
}

// A window's size when its corner is dragged dx, dy pixels from `start`: no smaller than its tool allows and no
// wider than the canvas.
export function resized(start, dx, dy, canvasWidth) {
  const { minWidth, minHeight } = TOOL_SIZES[start.tool];
  const widest = 1 - start.x;
  return {
    ...start,
    width: clamp(start.width + dx / canvasWidth, Math.min(minWidth / canvasWidth, widest), widest),
    height: Math.max(minHeight, start.height + dy),
  };
}

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const KEY = 'ttrpg-toolkit-home-canvas';
const GAP = 24;
// Where the default Home's tools sit on a desktop: the roller and notepad side by side, the card drawer below.
const RECTS = {
  'home-top': { left: 20, top: 80, width: 1000, height: 400 },
  'quick-roller': { left: 20, top: 80, width: 488, height: 400 },
  notepad: { left: 532, top: 80, width: 488, height: 400 },
  'card-drawer': { left: 20, top: 504, width: 1000, height: 500 },
  'home-canvas': { left: 8, top: 68, width: 1000 + GAP, height: 0 },
};
const NO_RECT = { left: 0, top: 0, width: 0, height: 0 };

const windowOf = (tool) => document.querySelector(`.home-window[data-tool="${tool}"]`);
const coverOf = (tool) => windowOf(tool).querySelector('.window-cover');
const tools = () => [...document.querySelectorAll('.home-window')].map((item) => item.dataset.tool);
const saved = () => JSON.parse(localStorage.getItem(KEY));
const placeOf = (tool) => saved().find((item) => item.tool === tool);
const addOptions = () => [...screen.getByLabelText('Add tool').options].slice(1).map((option) => option.textContent);
const varsOf = (tool) => ['--x', '--y', '--w', '--h'].map((name) => windowOf(tool).style.getPropertyValue(name));

function openHome() {
  render(<App />);
}

function edit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));
}

function drag(element, [fromX, fromY], ...points) {
  fireEvent.pointerDown(element, { clientX: fromX, clientY: fromY, pointerId: 1 });
  for (const [x, y] of points) fireEvent.pointerMove(element, { clientX: x, clientY: y });
  fireEvent.pointerUp(element);
}

beforeEach(() => {
  Element.prototype.setPointerCapture ??= () => {};
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf() {
    return RECTS[Object.keys(RECTS).find((name) => this.classList.contains(name))] ?? NO_RECT;
  });
  const computed = globalThis.getComputedStyle;
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element, ...rest) => (
    element.classList?.contains('home-top') ? { rowGap: `${GAP}px` } : computed(element, ...rest)));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the default Home', () => {
  it('is the roller and notepad side by side with the card drawer below, and its edit button is in the top bar', () => {
    openHome();
    expect(document.querySelector('main').className).toBe('home fit');
    const top = document.querySelector('.home-top');
    expect([...top.children].map((child) => child.className)).toEqual(['panel quick-roller', 'panel notepad']);
    expect(top.nextElementSibling.className).toBe('panel card-drawer');
    expect(document.querySelector('.home-canvas')).toBeNull();
    const header = document.querySelector('.app-header');
    expect(within(header).getByRole('button', { name: 'Edit layout' }).title).toBe('Edit layout');
    expect(localStorage.getItem(KEY)).toBe('');
  });

  it('keeps its controls only on the Home tab', () => {
    openHome();
    fireEvent.click(screen.getByRole('tab', { name: 'Notepad' }));
    expect(document.querySelector('.header-tools').children).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Home' }));
    expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
  });

  it('opens the canvas with every tool where it was, and saves nothing until something changes', () => {
    openHome();
    edit();
    expect(tools()).toEqual(['dice', 'notes', 'cards']);
    expect(varsOf('dice')).toEqual(['0', '0px', '0.5', '424px']);
    expect(varsOf('notes')).toEqual(['0.5', '0px', '0.5', '424px']);
    expect(varsOf('cards')).toEqual(['0', '424px', '1', '524px']);
    expect(windowOf('cards').style.getPropertyValue('--order')).toBe('2');
    expect(document.querySelector('.home-canvas').style.getPropertyValue('--canvas-height')).toBe('948px');
    const header = document.querySelector('.app-header');
    expect(header.querySelector('.home-controls.editing')).toBeTruthy();
    expect(within(header).getByLabelText('Add tool')).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Reset to default' })).toBeTruthy();

    fireEvent.pointerDown(windowOf('dice').querySelector('.window-body'));
    expect(windowOf('dice').style.zIndex).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.querySelector('.home-top')).toBeTruthy();
    expect(header.querySelector('.home-controls.editing')).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('');
  });

  it('measures with no gap when the gap cannot be read', () => {
    const computed = globalThis.getComputedStyle.getMockImplementation();
    globalThis.getComputedStyle.mockImplementation((element, ...rest) => (
      element.classList?.contains('home-top') ? { rowGap: '' } : computed(element, ...rest)));
    openHome();
    edit();
    expect(varsOf('notes')).toEqual([String(512 / 1000), '0px', String(488 / 1000), '400px']);
  });
});

describe('the Home canvas', () => {
  it('covers the tools while editing, so they ignore the pointer', () => {
    openHome();
    edit();
    expect(windowOf('notes').querySelector('.window-body').hasAttribute('inert')).toBe(true);
    expect(within(coverOf('notes')).getByText('Notepad')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.querySelector('.window-cover')).toBeNull();
  });

  it('adds the tools that are not there yet below the others, and removes them', () => {
    openHome();
    edit();
    expect(addOptions()).toEqual(['Character Sheet', 'Jenga']);
    fireEvent.change(screen.getByLabelText('Add tool'), { target: { value: 'jenga' } });
    expect(tools()).toEqual(['dice', 'notes', 'cards', 'jenga']);
    expect(placeOf('jenga')).toEqual({ tool: 'jenga', x: 0, y: 948, width: 0.5, height: 600, z: 4 });
    expect(screen.getByRole('heading', { name: 'Jenga' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Add tool'), { target: { value: 'sheet' } });
    expect(screen.queryByLabelText('Add tool')).toBeNull();

    fireEvent.click(within(coverOf('notes')).getByRole('button', { name: 'Remove' }));
    expect(tools()).not.toContain('notes');
    expect(addOptions()).toEqual(['Notepad']);
  });

  it('moves a dragged window, keeping it inside the canvas', () => {
    openHome();
    edit();
    drag(coverOf('dice'), [100, 100], [356, 150]);
    expect(placeOf('dice')).toEqual(expect.objectContaining({ x: 0.25, y: 50 }));
    drag(coverOf('dice'), [0, 0], [-900, -900]);
    expect(placeOf('dice')).toEqual(expect.objectContaining({ x: 0, y: 0 }));
    drag(coverOf('dice'), [0, 0], [2000, 30]);
    expect(placeOf('dice')).toEqual(expect.objectContaining({ x: 0.5, y: 30 }));
    fireEvent.pointerMove(coverOf('dice'), { clientX: 0, clientY: 0 });
    expect(placeOf('dice').x).toBe(0.5);
  });

  it('resizes from the corner grip, no smaller than the tool allows and no wider than the canvas', () => {
    openHome();
    edit();
    const grip = coverOf('notes').querySelector('.window-grip');
    drag(grip, [0, 0], [-900, -900]);
    expect(placeOf('notes')).toEqual(expect.objectContaining({ x: 0.5, width: 220 / 1024, height: 160 }));
    drag(grip, [0, 0], [900, 40]);
    expect(placeOf('notes')).toEqual(expect.objectContaining({ x: 0.5, width: 0.5, height: 200 }));
    fireEvent.pointerDown(grip, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerCancel(grip);
    fireEvent.pointerMove(grip, { clientX: -300, clientY: 0 });
    expect(placeOf('notes').width).toBe(0.5);
  });

  it('moves with the arrow keys and resizes with Shift and the arrow keys', () => {
    openHome();
    edit();
    const cover = coverOf('cards');
    fireEvent.keyDown(cover, { key: 'ArrowDown' });
    fireEvent.keyDown(cover, { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(cover, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(cover, { key: 'Enter' });
    expect(placeOf('cards')).toEqual(expect.objectContaining({ x: 0, y: 440, width: 1 - 16 / 1024, height: 508 }));
    fireEvent.keyDown(cover, { key: 'ArrowRight' });
    expect(placeOf('cards').x).toBe(16 / 1024);
  });

  it('brings the window pressed last to the front of a saved layout, without moving the others', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { tool: 'dice', x: 0, y: 0, width: 0.5, height: 400, z: 1 },
      { tool: 'notes', x: 0.5, y: 0, width: 0.5, height: 400, z: 2 },
      { tool: 'cards', x: 0, y: 400, width: 1, height: 500, z: 3 },
    ]));
    openHome();
    fireEvent.pointerDown(windowOf('dice').querySelector('.window-body'));
    expect(placeOf('dice').z).toBe(4);
    expect(windowOf('dice').style.zIndex).toBe('4');
    const before = localStorage.getItem(KEY);
    fireEvent.pointerDown(windowOf('dice'));
    expect(localStorage.getItem(KEY)).toBe(before);

    edit();
    drag(coverOf('notes'), [0, 0], [100, 0]);
    expect(placeOf('notes')).toEqual(expect.objectContaining({ x: 0.5, z: 5 }));
    fireEvent.pointerDown(within(coverOf('cards')).getByRole('button', { name: 'Remove' }));
    expect(placeOf('cards').z).toBe(6);
  });

  it('asks before going back to the default Home, which then shows as it first did', () => {
    openHome();
    edit();
    fireEvent.click(within(coverOf('notes')).getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(tools()).toEqual(['dice', 'cards']);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: 'Keep mine' })).toBeNull();

    edit();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(screen.getByText('Put Home back to the default layout? Your arrangement is replaced.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(localStorage.getItem(KEY)).toBe('');
    expect(document.querySelector('main').className).toBe('home fit');
    expect(document.querySelector('.home-canvas')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit layout' })).toBeTruthy();
  });

  it('comes back as it was left, and says so when it is empty', () => {
    localStorage.setItem(KEY, JSON.stringify([{ tool: 'jenga', x: 0.25, y: 10, width: 0.5, height: 400, z: 1 }]));
    openHome();
    expect(tools()).toEqual(['jenga']);
    expect(windowOf('jenga').style.getPropertyValue('--x')).toBe('0.25');
    edit();
    fireEvent.click(within(coverOf('jenga')).getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Home is empty. Use Edit layout to add tools.')).toBeTruthy();
    expect(saved()).toEqual([]);
  });
});

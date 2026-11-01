import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as playingCards from '@letele/playing-cards';
import App from '../src/App.jsx';
import CardDrawer from '../src/components/CardDrawer.jsx';
import DiceRoller from '../src/components/DiceRoller.jsx';
import Icon from '../src/components/Icon.jsx';
import ImageUpload from '../src/components/ImageUpload.jsx';
import Jenga from '../src/components/Jenga.jsx';
import QuickRoller from '../src/components/QuickRoller.jsx';
import SetPicker from '../src/components/SetPicker.jsx';
import ThumbGrid from '../src/components/ThumbGrid.jsx';
import TowerPicker from '../src/components/TowerPicker.jsx';
import props from '../src/dice3d/props.json';
import { DICE_SETS } from '../src/lib/diceSets.js';
import { buildPlayingDeck } from '../src/lib/decks.js';
import * as images from '../src/lib/images.js';
import * as table from './doubles/table.js';

vi.mock('../src/lib/images.js', async (importOriginal) => ({
  ...(await importOriginal()),
  readPicture: vi.fn(async () => ({ bitmap: { id: 'pixels' }, width: 1000, height: 1000, url: 'blob:picture' })),
  closePicture: vi.fn(),
  cropToDataUrl: vi.fn(() => 'data:image/webp;base64,BACK'),
  fileToDataUrl: vi.fn(async () => 'data:image/webp;base64,BACK'),
}));

beforeEach(() => {
  for (const fn of Object.values(table)) fn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

/* Makes crypto.getRandomValues hand out these numbers in turn, then zeros. */
function randomValues(...values) {
  const queue = [...values];
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((buffer) => {
    buffer[0] = queue.length ? queue.shift() : 0;
    return buffer;
  });
}

const settle = () => act(() => Promise.resolve());

function upload(input) {
  fireEvent.change(input, { target: { files: [new File(['x'], 'back.png', { type: 'image/png' })] } });
}

// Picks a picture with an upload button, then takes the crop window's frame as it opens.
async function uploadCropped(input) {
  upload(input);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));
}

describe('the app', () => {
  it('opens on Home with every tool, and each tab shows its own', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TTRPG Player Toolkit' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Home' }).getAttribute('aria-selected')).toBe('true');
    expect(['Dice Roller', 'Notepad', 'Card Drawer'].every((name) => screen.getByRole('heading', { name }))).toBe(true);
    expect(document.querySelector('main').className).toBe('home fit');
    for (const [tab, heading] of [['Dice Roller', 'Dice Roller'], ['Card Drawer', 'Card Drawer'], ['Notepad', 'Notepad'],
      ['Character Sheet', 'Character Sheet'], ['Jenga', 'Jenga']]) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain(heading);
    }
  });

  it('keeps the chosen style', () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('tabletop');
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'eldritch' } });
    expect(document.documentElement.dataset.theme).toBe('eldritch');
    expect(localStorage.getItem('ttrpg-toolkit-theme')).toBe('eldritch');
  });

  it('shares one deck between Home and the Card Drawer tab, and Home scrolls once there is one', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(document.querySelector('main').className).toBe('home');
    fireEvent.click(screen.getByRole('tab', { name: 'Card Drawer' }));
    expect(screen.getByText('Draw pile: 52')).toBeTruthy();
  });
});

describe('the notepad', () => {
  it('keeps what is written', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Bree: the Prancing Pony' } });
    expect(localStorage.getItem('ttrpg-toolkit-notes')).toBe('Bree: the Prancing Pony');
  });
});

/* The Card Drawer with the deck state App would hold for it. */
function deck() {
  const drawer = { stack: null };
  function Drawer() {
    const [stack, setStack] = useState(null);
    drawer.stack = stack;
    return <CardDrawer stack={stack} setStack={setStack} />;
  }
  render(<Drawer />);
  return drawer;
}

describe('the card drawer', () => {
  it('builds a deck, draws, discards and shuffles the discards back in', () => {
    randomValues();
    const drawer = deck();
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(screen.getByText('1 playing card deck')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Draw from Playing Cards' }).style.getPropertyValue('--depth')).toBe('7px');
    expect(screen.getByRole('button', { name: 'Discard' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
    const card = drawer.stack.piles[0].drawn[0].card;
    expect(screen.getByRole('img', { name: card.name })).toBeTruthy();
    expect(screen.getByText('Draw pile: 51')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Draw from Playing Cards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('Discard: 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle Discard In' }));
    expect(screen.getByText('Draw pile: 52')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shuffle Discard In' }).disabled).toBe(true);
  });

  it('adds jokers and more decks, and thickens the deck to a limit', () => {
    deck();
    fireEvent.click(screen.getByRole('switch', { name: 'Include Jokers' }));
    fireEvent.change(screen.getByLabelText('Decks'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(screen.getByText('2 playing card decks')).toBeTruthy();
    expect(screen.getByText('Draw pile: 108')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Deck' }));
    expect(screen.getByText('Draw pile: 162')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Draw from Playing Cards' }).style.getPropertyValue('--depth')).toBe('8px');
  });

  it('can split tarot into two piles, and draws tarot cards upright or reversed', () => {
    deck();
    fireEvent.change(screen.getByLabelText('Deck'), { target: { value: 'tarot' } });
    expect(screen.queryByRole('switch', { name: 'Include Jokers' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Split Major/Minor Arcana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(screen.getByText('1 tarot deck')).toBeTruthy();
    const [major] = screen.getAllByRole('heading', { level: 3 }).map((h) => h.closest('.pile'));
    randomValues(0);
    fireEvent.click(within(major).getByRole('button', { name: 'Draw' }));
    expect(within(major).getByRole('img').getAttribute('alt')).toMatch(/ \(Reversed\)$/);
    randomValues(99);
    fireEvent.click(within(major).getByRole('button', { name: 'Draw' }));
    expect(within(major).getAllByRole('img')[1].getAttribute('alt')).not.toMatch(/Reversed/);
  });

  it('has a face picture for every playing card', () => {
    expect(buildPlayingDeck(true).filter((card) => !playingCards[card.face])).toEqual([]);
  });

  it('shows an uploaded card back, and puts the themed back back', async () => {
    deck();
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(document.querySelector('.card-back.themed')).toBeTruthy();
    await uploadCropped(screen.getByLabelText('Playing card back'));
    expect(document.querySelector('img.card-back').getAttribute('src')).toBe('data:image/webp;base64,BACK');
    fireEvent.click(screen.getByRole('button', { name: 'Reset back' }));
    expect(document.querySelector('.card-back.themed')).toBeTruthy();
  });

  it('keeps a separate back for each deck type, cropped to its own card shape', async () => {
    deck();
    upload(screen.getByLabelText('Playing card back'));
    await settle();
    expect(screen.getByText(/A 366 × 512 picture/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));

    fireEvent.change(screen.getByLabelText('Deck'), { target: { value: 'tarot' } });
    expect(screen.queryByRole('button', { name: 'Reset back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Build Deck' }));
    expect(document.querySelector('.card-back.themed')).toBeTruthy();
    expect(document.querySelector('.pile').style.getPropertyValue('--card-aspect')).toBe(String(7 / 12));

    images.cropToDataUrl.mockReturnValueOnce('data:image/webp;base64,TAROT');
    upload(screen.getByLabelText('Tarot back'));
    await settle();
    expect(screen.getByText(/A 299 × 512 picture/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));
    expect(document.querySelector('img.card-back').getAttribute('src')).toBe('data:image/webp;base64,TAROT');
    expect([localStorage.getItem('ttrpg-toolkit-card-back'), localStorage.getItem('ttrpg-toolkit-tarot-back')])
      .toEqual(['data:image/webp;base64,BACK', 'data:image/webp;base64,TAROT']);
  });

  it('ignores an upload with no file chosen', async () => {
    deck();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [] } });
    await settle();
    expect(screen.queryByRole('button', { name: 'Reset back' })).toBeNull();
  });
});

describe('the quick roller', () => {
  it('rolls the chosen dice', () => {
    randomValues(2, 5);
    render(<QuickRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'More dice' }));
    fireEvent.click(screen.getByLabelText('d8'));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    const result = document.querySelector('.roll-result');
    expect([result.querySelector('.roll-label').textContent, result.querySelector('.roll-total').textContent]).toEqual(
      ['2d8', '9']);
  });

  it('starts on a d6 and marks its highest and lowest faces', () => {
    randomValues(5, 0);
    render(<QuickRoller />);
    expect(screen.getByLabelText('d6').checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'More dice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect([...document.querySelectorAll('.roll-dice .die')].map((die) => die.className)).toEqual(['die max', 'die min']);
  });

  it('keeps the dice count between 1 and 10', () => {
    render(<QuickRoller />);
    const fewer = screen.getByRole('button', { name: 'Fewer dice' });
    expect(fewer.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Dice'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'More dice' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Dice'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'More dice' }));
    expect(screen.getByLabelText('Dice').value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Fewer dice' }));
    expect(screen.getByLabelText('Dice').value).toBe('1');
  });

  it('rolls on the 3D table when animated, showing the chosen set', async () => {
    table.rollOnTable.mockResolvedValue([3, 4]);
    render(<QuickRoller />);
    const sets = document.querySelector('.quick-sets');
    expect([sets.hasAttribute('inert'), sets.querySelector('.set-preview') !== null]).toEqual([true, true]);
    expect(table.prepareTable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    expect(document.querySelector('.quick-sets')).toBe(sets);
    expect(sets.hasAttribute('inert')).toBe(false);
    await waitFor(() => expect(table.prepareTable).toHaveBeenCalledWith(expect.objectContaining({ id: 'base' })));
    expect(document.querySelector('.set-preview').getAttribute('src')).toBe('/dice/thumbs/base.webp');
    fireEvent.change(screen.getByLabelText('Dice'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('7'));
    expect(table.rollOnTable).toHaveBeenCalledWith(2, 6, expect.objectContaining({ id: 'base' }));
  });

  it('shows only the latest roll when an earlier one lands late', async () => {
    let finishFirst;
    table.rollOnTable.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce([2]);
    render(<QuickRoller />);
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('2'));
    await act(async () => finishFirst([4]));
    expect(document.querySelector('.roll-total').textContent).toBe('2');
  });

  it('shows nothing for a throw that was replaced on the table', async () => {
    table.rollOnTable.mockResolvedValue(null);
    render(<QuickRoller />);
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await settle();
    await settle();
    expect(document.querySelector('.roll-total')).toBeNull();
  });
});

describe('the dice roller page', () => {
  const flip = (name) => fireEvent.click(screen.getByRole('switch', { name }));
  const MAT_CALLS = ['prepareMat', 'mountMat', 'setMat', 'setTower', 'rollOnMat'];

  it('rolls without the mat until animation is turned on', () => {
    randomValues(19);
    render(<DiceRoller />);
    expect(document.querySelector('.set-picker').hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.roll-options').hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByLabelText('d20'));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(document.querySelector('.roll-label').textContent).toBe('1d20');
    expect(document.querySelector('.roll-total').textContent).toBe('20');
    expect(screen.queryByRole('heading', { name: 'Roll Mat' })).toBeNull();
  });

  it('throws animated dice across the window with the mat off, loading nothing for the mat', async () => {
    table.rollOnTable.mockResolvedValue([2]);
    render(<DiceRoller />);
    flip('Animate');
    await waitFor(() => expect(table.prepareTable).toHaveBeenCalledWith(expect.objectContaining({ id: 'base' })));
    expect([screen.getByRole('switch', { name: 'Mat' }).checked, screen.getByRole('switch', { name: 'Dice tower' }).disabled])
      .toEqual([false, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('2'));
    expect(table.rollOnTable).toHaveBeenCalledWith(1, 6, expect.objectContaining({ id: 'base' }));
    expect(MAT_CALLS.filter((name) => table[name].mock.calls.length)).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Roll Mat' })).toBeNull();
    expect(document.querySelector('.dice-page').className).toBe('dice-page');
  });

  it('mounts the 3D mat once switched on, sends it every setting and rolls on it', async () => {
    const unmount = vi.fn();
    table.mountMat.mockReturnValue(unmount);
    table.rollOnMat.mockResolvedValue([6]);
    const view = render(<DiceRoller />);
    flip('Animate');
    flip('Mat');
    expect(localStorage.getItem('ttrpg-toolkit-mat')).toBe('on');
    expect(document.querySelector('.dice-page').className).toBe('dice-page with-mat');
    await waitFor(() => expect(table.mountMat).toHaveBeenCalledWith(document.querySelector('.mat-view')));
    await waitFor(() => expect(table.prepareMat).toHaveBeenCalledWith(expect.objectContaining({ id: 'base' })));
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'felt', color: '#2f6b45', image: '', rim: 'none' });
    expect(table.setTower).toHaveBeenLastCalledWith('none');
    expect(screen.getByRole('heading', { name: 'Mat' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Tower' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Velvet'));
    await settle();
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'velvet', color: '#7a1c2b', image: '', rim: 'none' });
    fireEvent.change(document.querySelector('input[type="color"]'), { target: { value: '#123456' } });
    fireEvent.click(screen.getByLabelText('Wood', { selector: 'input[name="rim"]' }));
    upload(screen.getByLabelText('Mat image'));
    await settle();
    expect(document.querySelector('.crop-hint')).toBeNull();
    expect(parseFloat(document.querySelector('.crop-frame').style.height)).toBeCloseTo(100 / 1.6);
    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));
    await settle();
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'velvet', color: '#123456',
      image: 'data:image/webp;base64,BACK', rim: 'wood' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    await settle();
    expect(table.setMat.mock.lastCall[0].image).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('6'));
    expect(table.rollOnMat).toHaveBeenCalledWith(1, 6, expect.objectContaining({ id: 'base' }));
    expect(table.rollOnTable).not.toHaveBeenCalled();

    flip('Mat');
    expect(screen.queryByRole('heading', { name: 'Roll Mat' })).toBeNull();
    expect(unmount).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Dice tower' }).disabled).toBe(true);
    view.unmount();
  });

  it('shows the tower options only while the dice tower is on, and brings back the tower chosen last', async () => {
    localStorage.setItem('ttrpg-toolkit-mat', 'on');
    render(<DiceRoller />);
    flip('Animate');
    expect(screen.queryByRole('heading', { name: 'Tower' })).toBeNull();
    flip('Dice tower');
    await settle();
    expect(table.setTower).toHaveBeenLastCalledWith(props.towers[0].id);
    const towers = within(document.querySelector('.tower-settings'));
    expect(towers.getByRole('img', { name: 'Lighthouse' }).getAttribute('src')).toBe('/towers/thumbs/lighthouse.webp');
    fireEvent.click(towers.getByRole('img', { name: 'Lighthouse' }));
    await settle();
    expect(table.setTower).toHaveBeenLastCalledWith('lighthouse');
    expect(localStorage.getItem('ttrpg-toolkit-tower')).toBe('lighthouse');

    flip('Dice tower');
    await settle();
    expect(screen.queryByRole('heading', { name: 'Tower' })).toBeNull();
    expect(table.setTower).toHaveBeenLastCalledWith('none');
    flip('Dice tower');
    await settle();
    expect(table.setTower).toHaveBeenLastCalledWith('lighthouse');
  });

  it('does not mount the mat when the page closes before the 3D code has loaded', async () => {
    localStorage.setItem('ttrpg-toolkit-mat', 'on');
    const view = render(<DiceRoller />);
    flip('Animate');
    view.unmount();
    await settle();
    expect(table.mountMat).not.toHaveBeenCalled();
  });
});

describe('the dice set picker', () => {
  const chosen = { id: null };

  function Picker({ initial }) {
    const [diceSet, setDiceSet] = useState(initial);
    chosen.id = diceSet;
    return <SetPicker diceSet={diceSet} setDiceSet={setDiceSet} />;
  }

  function open(initial = 'base') {
    render(<Picker initial={initial} />);
  }

  const categories = () => [...document.querySelectorAll('.segmented label')].map((label) => label.textContent);
  const shownSets = () => [...document.querySelectorAll('.thumb-option')].map((option) => option.title);

  it('lists a category\'s sets and switches category to its first set', () => {
    open();
    expect(categories()).toEqual(['Basic', 'Premium', 'Weird']);
    expect(shownSets()).toEqual(DICE_SETS.filter((set) => set.category === 'Basic').slice(0, 10).map((set) => set.label));
    fireEvent.click(screen.getByLabelText('Premium'));
    const premium = DICE_SETS.filter((set) => set.category === 'Premium');
    expect(chosen.id).toBe(premium[0].id);
    expect(shownSets()).toEqual(premium.slice(0, 10).map((set) => set.label));
    fireEvent.click(screen.getByRole('img', { name: premium[2].label }));
    expect(chosen.id).toBe(premium[2].id);
  });

  it('collects favorites in their own tab and leaves it when the last one is unstarred', () => {
    open('base');
    fireEvent.click(screen.getByRole('button', { name: 'Add Ivory to Favorites' }));
    expect(categories()[0]).toBe('Favorites');
    expect(JSON.parse(localStorage.getItem('ttrpg-toolkit-dice-favorites'))).toEqual(['base']);
    fireEvent.click(screen.getByLabelText('Favorites'));
    expect(shownSets()).toEqual(['Ivory']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ivory from Favorites' }));
    expect(categories()).toEqual(['Basic', 'Premium', 'Weird']);
    expect(document.querySelector('.segmented input:checked').parentElement.textContent).toBe('Basic');
  });

  it('pages through more favorites than fit, keeping every page the same height', () => {
    const many = DICE_SETS.slice(0, 11).map((set) => set.id);
    localStorage.setItem('ttrpg-toolkit-dice-favorites', JSON.stringify([...many, 'retired-set']));
    open(many[10]);
    fireEvent.click(screen.getByLabelText('Favorites'));
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(shownSets()).toHaveLength(1);
    expect(document.querySelectorAll('.thumb-empty')).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(shownSets()).toHaveLength(10);
  });

  it('starts from an empty favorites list when the saved one cannot be read', () => {
    localStorage.setItem('ttrpg-toolkit-dice-favorites', 'not json');
    open();
    expect(categories()).toEqual(['Basic', 'Premium', 'Weird']);
  });

  it('starts from an empty favorites list when the saved one is not a list', () => {
    localStorage.setItem('ttrpg-toolkit-dice-favorites', '{"base": true}');
    open();
    expect(categories()).toEqual(['Basic', 'Premium', 'Weird']);
  });
});

describe('the tower picker', () => {
  it('shows every tower on one page, names the chosen one and passes on a pick', () => {
    const last = props.towers.at(-1);
    const setTower = vi.fn();
    render(<TowerPicker tower={last.id} setTower={setTower} />);
    expect([...document.querySelectorAll('.thumb-option')].map((option) => option.title)).toEqual(
      props.towers.map((tower) => tower.label));
    expect(screen.getByText(last.label, { selector: '.picker-name' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    fireEvent.click(screen.getByRole('img', { name: props.towers[0].label }));
    expect(setTower).toHaveBeenCalledWith(props.towers[0].id);
  });
});

describe('Jenga', () => {
  it('pulls blocks, keeps the tower and can start over', () => {
    randomValues(1);
    render(<Jenga />);
    expect(document.querySelectorAll('.level')).toHaveLength(18);
    expect(document.querySelectorAll('.level.crosswise')).toHaveLength(9);
    expect(screen.getByText('Solid')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
    fireEvent.change(screen.getByLabelText('Tension'), { target: { value: 'more-tense' } });
    randomValues(0, 999_999);
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }));
    expect(screen.getByText('Pulls: 1')).toBeTruthy();
    const levels = document.querySelectorAll('.level');
    expect(levels).toHaveLength(19);
    expect([...levels[0].children].map((block) => block.className)).toEqual(['block gone', 'block', 'block']);
    expect([...levels[18].children].map((block) => block.className)).toEqual(['block', 'block gone', 'block gone']);
    expect(JSON.parse(localStorage.getItem('ttrpg-toolkit-jenga')).tension).toBe('more-tense');
    expect(screen.getByLabelText('Tension').disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Start Over' }));
    expect(screen.getByText('Pulls: 0')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Over' })).toBeNull();
  });

  it('shows a fallen tower and stops the pulls', () => {
    randomValues(0, 0, 0);
    render(<Jenga />);
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }));
    expect(screen.getByText('The tower fell!').dataset.condition).toBe('fallen');
    expect(document.querySelector('.tower').className).toBe('tower fallen');
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('button', { name: 'Pull' }).disabled).toBe(true);
  });

  it('starts a new tower when the saved one cannot be read', () => {
    localStorage.setItem('ttrpg-toolkit-jenga', '{"pulls":');
    render(<Jenga />);
    expect(screen.getByText('Pulls: 0')).toBeTruthy();
  });
});

describe('the crop window', () => {
  const onChange = vi.fn();
  const frame = () => screen.getByLabelText('Crop area');
  const box = () => ['left', 'top', 'width', 'height'].map((side) => parseFloat(frame().style[side]));

  beforeEach(() => {
    onChange.mockReset();
    Element.prototype.setPointerCapture ??= () => {};
  });

  async function open(width, height) {
    images.readPicture.mockResolvedValueOnce({ bitmap: { id: 'pixels' }, width, height, url: 'blob:picture' });
    render(<ImageUpload label="Playing card back" maxSize={512} aspect={5 / 7} fitHint="a playing card back"
      onChange={onChange} />);
    upload(screen.getByLabelText('Playing card back'));
    await settle();
  }

  it('starts at the largest frame that fits, says what size would fit, and saves the crop', async () => {
    await open(1000, 1000);
    expect(screen.getByRole('dialog', { name: 'Playing card back' }).querySelector('img').getAttribute('src'))
      .toBe('blob:picture');
    box().forEach((value, i) => expect(value).toBeCloseTo([14.2857, 0, 71.4286, 100][i], 3));
    expect(document.querySelector('.crop-hint').textContent).toMatch(/cut to fit a playing card back\. A 366 × 512 picture/);
    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));
    expect(images.cropToDataUrl).toHaveBeenLastCalledWith({ id: 'pixels' }, {
      x: expect.closeTo(142.857, 2), y: 0, width: expect.closeTo(714.286, 2), height: 1000,
    }, 512);
    expect(onChange).toHaveBeenCalledWith('data:image/webp;base64,BACK');
    expect(images.closePicture).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('zooms in and moves the frame by dragging or with the arrow keys, never past the picture', async () => {
    await open(700, 500);
    vi.spyOn(document.querySelector('.crop-stage'), 'getBoundingClientRect').mockReturnValue({ width: 350 });
    fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
    box().forEach((value, i) => expect(value).toBeCloseTo([37.2449, 25, 25.5102, 50][i], 3));

    fireEvent.pointerDown(frame(), { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 120, clientY: 100 });
    expect(box()[0]).toBeCloseTo(37.2449 + (20 * 2 / 700) * 100, 3);
    fireEvent.pointerMove(frame(), { clientX: 900, clientY: -900 });
    expect(box().slice(0, 2)).toEqual([expect.closeTo(74.4898, 3), 0]);
    fireEvent.pointerUp(frame());
    fireEvent.pointerMove(frame(), { clientX: 100, clientY: 100 });
    expect(box()[0]).toBeCloseTo(74.4898, 3);
    fireEvent.pointerDown(frame(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerCancel(frame());
    fireEvent.pointerMove(frame(), { clientX: -500, clientY: 0 });
    expect(box()[0]).toBeCloseTo(74.4898, 3);

    fireEvent.keyDown(frame(), { key: 'ArrowLeft' });
    expect(box()[0]).toBeCloseTo(74.4898 - (178.571 * 0.05 / 700) * 100, 3);
    fireEvent.keyDown(frame(), { key: 'ArrowDown' });
    expect(box()[1]).toBeCloseTo((250 * 0.05 / 500) * 100, 3);
    fireEvent.keyDown(frame(), { key: 'ArrowRight' });
    fireEvent.keyDown(frame(), { key: 'ArrowUp' });
    fireEvent.keyDown(frame(), { key: 'a' });
    expect(box().slice(0, 2)).toEqual([expect.closeTo(74.4898, 3), 0]);

    fireEvent.keyDown(frame(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives no hint for a picture already in the card shape, and Cancel keeps the old picture', async () => {
    await open(500, 700);
    expect(document.querySelector('.crop-hint')).toBeNull();
    box().forEach((value, i) => expect(value).toBeCloseTo([0, 0, 100, 100][i], 3));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('small parts', () => {
  it('pads a picture grid and labels options without a picture', () => {
    render(<ThumbGrid name="t" label="Towers" options={[{ id: 'none', label: 'None' }]} value="none" onChange={() => {}}
      fill={3} />);
    expect(screen.getByText('None')).toBeTruthy();
    expect(document.querySelectorAll('.thumb-empty')).toHaveLength(2);
  });

  it('draws icons with an extra class when asked', () => {
    const { container } = render(<><Icon name="d6" /><Icon name="star" className="big" /></>);
    expect([...container.querySelectorAll('svg')].map((svg) => svg.getAttribute('class'))).toEqual(['icon', 'icon big']);
  });
});

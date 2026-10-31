import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as playingCards from '@letele/playing-cards';
import App from '../src/App.jsx';
import CardDrawer from '../src/components/CardDrawer.jsx';
import DiceRoller from '../src/components/DiceRoller.jsx';
import Icon from '../src/components/Icon.jsx';
import Jenga from '../src/components/Jenga.jsx';
import QuickRoller from '../src/components/QuickRoller.jsx';
import SetPicker from '../src/components/SetPicker.jsx';
import ThumbGrid from '../src/components/ThumbGrid.jsx';
import TowerPicker from '../src/components/TowerPicker.jsx';
import props from '../src/dice3d/props.json';
import { DICE_SETS } from '../src/hooks/useDiceRoll.js';
import { buildPlayingDeck } from '../src/lib/decks.js';
import * as table from './doubles/table.js';

vi.mock('../src/lib/images.js', () => ({ fileToDataUrl: vi.fn(async () => 'data:image/webp;base64,BACK') }));

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

describe('the app', () => {
  it('opens on Home with every tool, and each tab shows its own', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TTRPG Player Toolkit' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Home' }).getAttribute('aria-selected')).toBe('true');
    expect(['Dice Roller', 'Notepad', 'Card Drawer'].every((name) => screen.getByRole('heading', { name }))).toBe(true);
    expect(document.querySelector('main').className).toBe('home fit');
    for (const [tab, heading] of [['Dice Roller', 'Dice Roller'], ['Card Drawer', 'Card Drawer'], ['Notepad', 'Notepad'],
      ['Jenga', 'Jenga']]) {
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
    upload(document.querySelector('input[type="file"]'));
    await settle();
    expect(document.querySelector('img.card-back').getAttribute('src')).toBe('data:image/webp;base64,BACK');
    fireEvent.click(screen.getByRole('button', { name: 'Reset back' }));
    expect(document.querySelector('.card-back.themed')).toBeTruthy();
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
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    const result = document.querySelector('.roll-result');
    expect([result.querySelector('.roll-label').textContent, result.querySelector('.roll-total').textContent]).toEqual(
      ['2d8', '9']);
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
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    await waitFor(() => expect(table.prepareTable).toHaveBeenCalledWith('base'));
    expect(document.querySelector('.set-preview').getAttribute('src')).toBe('/dice/thumbs/base.webp');
    fireEvent.change(screen.getByLabelText('Dice'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('7'));
    expect(table.rollOnTable).toHaveBeenCalledWith(2, 4, 'base');
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
  it('rolls without the mat until animation is turned on', () => {
    randomValues(19);
    render(<DiceRoller />);
    expect(document.querySelector('.set-picker').hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByLabelText('d20'));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(document.querySelector('.roll-label').textContent).toBe('1d20');
    expect(document.querySelector('.roll-total').textContent).toBe('20');
    expect(screen.queryByRole('heading', { name: 'Roll Mat' })).toBeNull();
  });

  it('mounts the 3D mat, sends it every setting and rolls on it', async () => {
    const unmount = vi.fn();
    table.mountMat.mockReturnValue(unmount);
    table.rollOnMat.mockResolvedValue([6]);
    const view = render(<DiceRoller />);
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    await waitFor(() => expect(table.mountMat).toHaveBeenCalledWith(document.querySelector('.mat-view')));
    await waitFor(() => expect(table.prepareMat).toHaveBeenCalledWith('base'));
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'felt', color: '#2f6b45', image: '', rim: 'none' });
    expect(table.setTower).toHaveBeenLastCalledWith('none');

    fireEvent.click(screen.getByLabelText('Velvet'));
    await settle();
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'velvet', color: '#7a1c2b', image: '', rim: 'none' });
    fireEvent.change(document.querySelector('input[type="color"]'), { target: { value: '#123456' } });
    fireEvent.click(screen.getByLabelText('Wood', { selector: 'input[name="rim"]' }));
    upload(document.querySelector('input[type="file"]'));
    await settle();
    expect(table.setMat).toHaveBeenLastCalledWith({ surface: 'velvet', color: '#123456',
      image: 'data:image/webp;base64,BACK', rim: 'wood' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    await settle();
    expect(table.setMat.mock.lastCall[0].image).toBe('');

    fireEvent.click(screen.getByRole('switch', { name: 'Tower' }));
    await settle();
    expect(table.setTower).toHaveBeenLastCalledWith('castle-keep');
    const towers = within(document.querySelector('.tower-picker'));
    expect(towers.getByRole('img', { name: 'Lighthouse' }).getAttribute('src')).toBe('/towers/thumbs/lighthouse.webp');
    fireEvent.click(towers.getByRole('img', { name: 'Lighthouse' }));
    await settle();
    expect(table.setTower).toHaveBeenLastCalledWith('lighthouse');
    expect(localStorage.getItem('ttrpg-toolkit-tower')).toBe('lighthouse');

    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('6'));
    expect(table.rollOnMat).toHaveBeenCalledWith(1, 4, 'base');
    view.unmount();
    expect(unmount).toHaveBeenCalled();
  });

  it('does not mount the mat when the page closes before the 3D code has loaded', async () => {
    const view = render(<DiceRoller />);
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
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
    expect(categories()).toEqual(['Base', 'Basic', 'Premium', 'Weird']);
    expect(shownSets()).toEqual(DICE_SETS.filter((set) => set.category === 'Base').map((set) => set.label));
    fireEvent.click(screen.getByLabelText('Premium'));
    const premium = DICE_SETS.filter((set) => set.category === 'Premium');
    expect(chosen.id).toBe(premium[0].id);
    expect(shownSets()).toEqual(premium.slice(0, 9).map((set) => set.label));
    fireEvent.click(screen.getByRole('img', { name: premium[2].label }));
    expect(chosen.id).toBe(premium[2].id);
  });

  it('collects favorites in their own tab and leaves it when the last one is unstarred', () => {
    open('base');
    fireEvent.click(screen.getByRole('button', { name: 'Add Base to Favorites' }));
    expect(categories()[0]).toBe('Favorites');
    expect(JSON.parse(localStorage.getItem('ttrpg-toolkit-dice-favorites'))).toEqual(['base']);
    fireEvent.click(screen.getByLabelText('Favorites'));
    expect(shownSets()).toEqual(['Base']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Base from Favorites' }));
    expect(categories()).toEqual(['Base', 'Basic', 'Premium', 'Weird']);
    expect(document.querySelector('.segmented input:checked').parentElement.textContent).toBe('Base');
  });

  it('pages through more favorites than fit, keeping every page the same height', () => {
    const many = DICE_SETS.slice(0, 11).map((set) => set.id);
    localStorage.setItem('ttrpg-toolkit-dice-favorites', JSON.stringify([...many, 'retired-set']));
    open(many[10]);
    fireEvent.click(screen.getByLabelText('Favorites'));
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(shownSets()).toHaveLength(2);
    expect(document.querySelectorAll('.thumb-empty')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(shownSets()).toHaveLength(9);
  });

  it('starts from an empty favorites list when the saved one cannot be read', () => {
    localStorage.setItem('ttrpg-toolkit-dice-favorites', 'not json');
    open();
    expect(categories()).toEqual(['Base', 'Basic', 'Premium', 'Weird']);
  });

  it('starts from an empty favorites list when the saved one is not a list', () => {
    localStorage.setItem('ttrpg-toolkit-dice-favorites', '{"base": true}');
    open();
    expect(categories()).toEqual(['Base', 'Basic', 'Premium', 'Weird']);
  });
});

describe('the tower picker', () => {
  const chosen = { id: null };

  function Picker({ initial }) {
    const [tower, setTower] = useState(initial);
    chosen.id = tower;
    return <TowerPicker tower={tower} setTower={setTower} />;
  }

  const towersIn = (category) => props.towers.filter((tower) => tower.category === category);
  const shownTowers = () => [...document.querySelectorAll('.thumb-option')].map((option) => option.title);
  const flip = () => fireEvent.click(screen.getByRole('switch', { name: 'Tower' }));

  it('stands no tower and dims the picker until switched on, then stands the first tower on screen', () => {
    render(<Picker initial="none" />);
    expect(screen.getByRole('switch', { name: 'Tower' }).checked).toBe(false);
    expect(document.querySelector('.tower-picker').hasAttribute('inert')).toBe(true);
    expect(screen.getByText('No tower')).toBeTruthy();
    flip();
    expect(chosen.id).toBe(towersIn('Basic')[0].id);
    expect(document.querySelector('.tower-picker').hasAttribute('inert')).toBe(false);
  });

  it('switches back on to the tower chosen last', () => {
    render(<Picker initial="none" />);
    flip();
    const second = towersIn('Basic')[1];
    fireEvent.click(screen.getByRole('img', { name: second.label }));
    flip();
    expect(chosen.id).toBe('none');
    flip();
    expect(chosen.id).toBe(second.id);
  });

  it('opens on the chosen tower\'s category and page, and a category tab stands its first tower', () => {
    const weird = towersIn('Weird');
    render(<Picker initial={weird[10].id} />);
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByText(weird[10].label, { selector: '.picker-name' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Premium'));
    expect(chosen.id).toBe(towersIn('Premium')[0].id);
    expect(shownTowers()).toEqual(towersIn('Premium').map((tower) => tower.label));
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});

describe('Jenga', () => {
  it('pulls blocks, keeps the tower and can start over', () => {
    randomValues(1);
    render(<Jenga />);
    expect(document.querySelectorAll('.level')).toHaveLength(18);
    expect(document.querySelectorAll('.level.crosswise')).toHaveLength(9);
    expect(screen.getByText('Solid')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Pull' }).disabled).toBe(true);
  });

  it('starts a new tower when the saved one cannot be read', () => {
    localStorage.setItem('ttrpg-toolkit-jenga', '{"pulls":');
    render(<Jenga />);
    expect(screen.getByText('Pulls: 0')).toBeTruthy();
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

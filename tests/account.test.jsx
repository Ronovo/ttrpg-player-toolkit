import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { api } from '../src/lib/api.js';
import * as table from './doubles/table.js';
import { LOGGED_IN, LOGGED_OUT, PORTFOLIO, empty, json, serve } from './fakeServer.js';

vi.mock('../src/lib/images.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fileToDataUrl: vi.fn(async () => 'data:image/webp;base64,SHOT'),
}));

const settle = () => act(() => Promise.resolve());

beforeEach(() => {
  for (const fn of Object.values(table)) fn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('portfolio login in the header', () => {
  it('shows no account controls when the server has no portfolio login', async () => {
    serve({ 'GET /api/me': () => json({ enabled: false }) });
    render(<App />);
    await settle();
    await settle();
    expect(screen.queryByText(/Log in/)).toBeNull();
    expect(screen.queryByText(/Log out/)).toBeNull();
  });

  it('stays logged out when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    render(<App />);
    await settle();
    expect(screen.queryByText(/Log in/)).toBeNull();
  });

  it('offers the login and names the account the portfolio already knows', async () => {
    const calls = serve({
      'GET /api/me': () => json(LOGGED_OUT),
      [`GET ${PORTFOLIO}/sso/me`]: () => json({ username: 'ronovo' }),
    });
    render(<App />);
    const link = await screen.findByText('Log in as ronovo');
    expect(link.getAttribute('href')).toBe('/sso/login');
    expect(calls.find((call) => call.key.endsWith('/sso/me')).init.credentials).toBe('include');
  });

  it('keeps the plain label when the portfolio does not say who is logged in there', async () => {
    serve({ 'GET /api/me': () => json(LOGGED_OUT), [`GET ${PORTFOLIO}/sso/me`]: () => json({}, 403) });
    render(<App />);
    expect(await screen.findByText('Log in with portfolio account')).toBeTruthy();
    cleanup();
    serve({ 'GET /api/me': () => json(LOGGED_OUT), [`GET ${PORTFOLIO}/sso/me`]: () => { throw new TypeError('blocked'); } });
    render(<App />);
    expect(await screen.findByText('Log in with portfolio account')).toBeTruthy();
  });

  it('shows a refused login once', async () => {
    serve({ 'GET /api/me': () => json({ ...LOGGED_OUT, loginError: 'Your portfolio login expired. Try again.' }) });
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toBe('Your portfolio login expired. Try again.');
  });

  it('logs out with a same-site request, with or without the dice list answering', async () => {
    const calls = serve({
      'GET /api/me': () => json(LOGGED_IN),
      'POST /api/logout': () => empty(),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'ronovo: Log out' }));
    expect(await screen.findByText('Log in with portfolio account')).toBeTruthy();
    expect(calls.find((call) => call.key === 'POST /api/logout').init.headers).toEqual({ 'X-Requested-With': 'fetch' });
  });
});

describe('my dice', () => {
  const OLD = { id: 'a1', label: 'Old Bones', thumbnail: true };
  const NEW = { id: 'b2', label: 'Seafoam', thumbnail: false };

  async function openDiceTab() {
    render(<App />);
    await screen.findByRole('button', { name: 'ronovo: Log out' });
    fireEvent.click(screen.getByRole('tab', { name: 'Dice Roller' }));
    expect(screen.getByRole('heading', { name: 'My Dice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Mat' }));
  }

  const categories = () => [...document.querySelectorAll('.segmented label')].map((label) => label.textContent);
  const modelInput = () => document.querySelector('input[type="file"][accept=".glb"]');

  it('lists, uploads, rolls and deletes the account\'s sets', async () => {
    const calls = serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [OLD] }),
      'POST /api/dice': () => json(NEW, 201),
      'DELETE /api/dice/a1': () => empty(),
      'DELETE /api/dice/b2': () => empty(),
    });
    await openDiceTab();
    await waitFor(() => expect(categories()).toContain('My Dice'));
    fireEvent.click(screen.getByLabelText('My Dice'));
    expect(screen.getByRole('img', { name: 'Old Bones' }).getAttribute('src')).toBe('/api/dice/a1/thumb');
    await waitFor(() => expect(table.prepareMat).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a1', custom: true, mass: 1 })));

    expect(screen.getByRole('button', { name: 'Upload' }).disabled).toBe(true);
    fireEvent.change(modelInput(), { target: { files: [] } });
    fireEvent.change(modelInput(), { target: { files: [new File(['glTF'], 'seafoam.glb')] } });
    expect(screen.getByText('seafoam.glb')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Seafoam' } });
    fireEvent.change(document.querySelector('input[accept="image/*"]'), { target: { files: [new File(['x'], 'shot.png')] } });
    expect(await screen.findByText('Screenshot added')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(document.querySelectorAll('.my-sets li')).toHaveLength(2));
    const body = calls.find((call) => call.key === 'POST /api/dice').init.body;
    expect([body.get('label'), body.get('thumbnail'), body.get('model').name]).toEqual(['Seafoam', 'data:image/webp;base64,SHOT', 'seafoam.glb']);
    expect(screen.getByLabelText('Name').value).toBe('');

    const generic = document.querySelector('.thumb-option[title="Seafoam"] .thumb-generic');
    expect([generic.querySelector('svg') !== null, generic.textContent]).toEqual([true, 'Seafoam']);
    fireEvent.click(generic);
    await waitFor(() => expect(table.prepareMat).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b2' })));
    table.rollOnMat.mockResolvedValue([4]);
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await waitFor(() => expect(document.querySelector('.roll-total')?.textContent).toBe('4'));
    expect(table.rollOnMat).toHaveBeenCalledWith(1, 6, expect.objectContaining({ id: 'b2', custom: true }));

    fireEvent.click(within(screen.getByText('Old Bones').closest('li')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Old Bones')).toBeNull());
    expect(calls.find((call) => call.key === 'DELETE /api/dice/a1').init.headers).toEqual({ 'X-Requested-With': 'fetch' });
    fireEvent.click(within(screen.getByText('Seafoam', { selector: '.my-sets span' }).closest('li')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(categories()).not.toContain('My Dice'));
    expect(screen.getByText('Ivory', { selector: '.picker-name' })).toBeTruthy();
    expect(document.querySelector('.segmented input:checked').parentElement.textContent).toBe('Basic');
  });

  it('shows the home preview as a plain die for an upload without a screenshot', async () => {
    serve({ 'GET /api/me': () => json(LOGGED_IN), 'GET /api/dice': () => json({ sets: [NEW] }) });
    localStorage.setItem('ttrpg-toolkit-dice-set', 'b2');
    render(<App />);
    await screen.findByRole('button', { name: 'ronovo: Log out' });
    fireEvent.click(screen.getByRole('switch', { name: 'Animate' }));
    await waitFor(() => expect(document.querySelector('svg.set-preview')).toBeTruthy());
    expect(table.prepareTable).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b2' }));
  });

  it('shows why the server refused an upload or a deletion', async () => {
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [OLD] }),
      'POST /api/dice': () => json({ error: 'The d6 is not the toolkit\'s d6 shape.' }, 400),
      'DELETE /api/dice/a1': () => new Response('gone wrong', { status: 500 }),
    });
    await openDiceTab();
    await waitFor(() => expect(categories()).toContain('My Dice'));
    fireEvent.change(modelInput(), { target: { files: [new File(['x'], 'bad.glb')] } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The d6 is not the toolkit\'s d6 shape.');
    expect(screen.getByLabelText('Name').value).toBe('Bad');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The server answered 500.'));
    expect(screen.getByText('Old Bones')).toBeTruthy();
  });
});

describe('the api helper', () => {
  it('passes the answer through and reports a bare failure by its status', async () => {
    serve({ 'GET /x': () => json({ ok: true }), 'GET /y': () => new Response('', { status: 502 }) });
    expect(await api('/x')).toEqual({ ok: true });
    await expect(api('/y')).rejects.toThrow('The server answered 502.');
  });
});

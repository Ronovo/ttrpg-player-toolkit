import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CharacterSheet from '../src/components/CharacterSheet.jsx';
import { AccountProvider } from '../src/hooks/useAccount.jsx';
import { downloadFile } from '../src/lib/download.js';
import * as reader from './doubles/reader.js';
import { LOGGED_IN, LOGGED_OUT, empty, json, serve } from './fakeServer.js';

vi.mock('../src/lib/download.js', () => ({ downloadFile: vi.fn() }));

const SHEET = { id: 's1', name: 'Thorin.pdf', size: 4, values: { '4R': { value: 'Thorin' } } };
const NEXT = { id: 's2', name: 'Gimli.pdf', size: 4, values: {} };
const PDF_BYTES = new Uint8Array([37, 80, 68, 70]);
const pdfResponse = () => new Response(PDF_BYTES);

const settle = () => act(() => Promise.resolve());

function handle(overrides = {}) {
  return {
    pages: 2,
    fillable: true,
    values: vi.fn(() => ({ '4R': { value: 'Thorin' } })),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitWidth: vi.fn(),
    filled: vi.fn(async () => new Uint8Array([1])),
    close: vi.fn(),
    ...overrides,
  };
}

function show() {
  return render(<AccountProvider><CharacterSheet /></AccountProvider>);
}

// The tab, logged in, with `sheet` already uploaded and its reader open as `opened`.
async function openSheet(routes = {}, opened = handle()) {
  reader.openSheet.mockResolvedValue(opened);
  const calls = serve({
    'GET /api/me': () => json(LOGGED_IN),
    'GET /api/dice': () => json({ sets: [] }),
    'GET /api/sheet': () => json({ sheet: SHEET }),
    'GET /api/sheet/file': pdfResponse,
    ...routes,
  });
  const view = show();
  await screen.findByText('2 pages');
  return { calls, view, opened, changed: reader.openSheet.mock.lastCall[3] };
}

const button = (name) => screen.getByRole('button', { name });
const pick = (name) => fireEvent.change(document.querySelector('input[type="file"]'), {
  target: { files: name ? [new File(['%PDF'], name, { type: 'application/pdf' })] : [] },
});

beforeEach(() => {
  reader.openSheet.mockReset();
  downloadFile.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the character sheet tab', () => {
  it('explains that it needs portfolio login when the server has none', async () => {
    serve({ 'GET /api/me': () => json({ enabled: false }) });
    show();
    expect(await screen.findByText(/portfolio login is not turned on/)).toBeTruthy();
  });

  it('asks a logged-out player to log in', async () => {
    serve({ 'GET /api/me': () => json(LOGGED_OUT), 'GET http://portfolio.test/sso/me': () => json({}) });
    show();
    expect(await screen.findByText('Log in with your portfolio account to keep a character sheet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in with portfolio account' }).getAttribute('href')).toBe('/sso/login');
  });

  it('uploads a first sheet and opens it in the reader', async () => {
    reader.openSheet.mockResolvedValue(handle({ pages: 1, fillable: false }));
    const calls = serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ sheet: null }),
      'PUT /api/sheet': () => json({ sheet: NEXT }),
      'GET /api/sheet/file': pdfResponse,
    });
    show();
    expect(await screen.findByText(/Upload a character sheet PDF/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    pick('');
    pick('Gimli.pdf');
    expect(await screen.findByText('1 page')).toBeTruthy();
    const upload = calls.find((call) => call.key === 'PUT /api/sheet').init;
    expect([upload.body.get('file').name, upload.headers]).toEqual(['Gimli.pdf', { 'X-Requested-With': 'fetch' }]);
    const [box, bytes, values] = reader.openSheet.mock.lastCall;
    expect([box.className, box.firstElementChild.className, bytes, values]).toEqual(['sheet-scroll', 'pdfViewer', PDF_BYTES, {}]);
    expect(screen.getByText('This PDF has no form fields to fill in.')).toBeTruthy();
  });

  it('opens the saved sheet with its values, zooms and downloads it filled in', async () => {
    const { opened } = await openSheet();
    expect(reader.openSheet.mock.lastCall[2]).toEqual(SHEET.values);
    expect(screen.getByText('Thorin.pdf')).toBeTruthy();
    expect(screen.queryByText(/no form fields/)).toBeNull();
    fireEvent.click(button('Zoom in'));
    fireEvent.click(button('Zoom out'));
    fireEvent.click(button('Fit width'));
    expect([opened.zoomIn, opened.zoomOut, opened.fitWidth].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
    fireEvent.click(button('Download'));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(new Uint8Array([1]), 'Thorin.pdf', 'application/pdf'));
  });

  it('saves what is typed two seconds after the last change', async () => {
    const { calls, changed } = await openSheet({ 'PUT /api/sheet/values': () => empty() });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => changed());
    expect(screen.getByText('Not saved yet')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    act(() => changed());
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(calls.some((call) => call.key === 'PUT /api/sheet/values')).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    const saved = calls.filter((call) => call.key === 'PUT /api/sheet/values');
    expect(saved.map((call) => [call.init.body, call.init.headers])).toEqual(
      [['{"4R":{"value":"Thorin"}}', { 'X-Requested-With': 'fetch' }]]);
  });

  it('saves a waiting change straight away when the tab closes, and closes the reader', async () => {
    const { calls, changed, opened, view } = await openSheet({ 'PUT /api/sheet/values': () => empty() });
    act(() => changed());
    view.unmount();
    expect(calls.filter((call) => call.key === 'PUT /api/sheet/values')).toHaveLength(1);
    expect(opened.close).toHaveBeenCalled();
  });

  it('says when a save fails', async () => {
    const { changed } = await openSheet({ 'PUT /api/sheet/values': () => json({ error: 'The sheet\'s values are too big to save.' }, 400) });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => changed());
    await act(() => vi.advanceTimersByTimeAsync(2000));
    vi.useRealTimers();
    expect((await screen.findByRole('alert')).textContent).toBe('The sheet\'s values are too big to save.');
    expect(screen.queryByText('Saving...')).toBeNull();
  });

  it('asks before replacing the sheet, then opens the new one', async () => {
    const { calls, opened } = await openSheet({ 'PUT /api/sheet': () => json({ sheet: NEXT }) });
    pick('Gimli.pdf');
    expect(screen.getByText('Replace Thorin.pdf with Gimli.pdf? What is filled in on Thorin.pdf goes with it.')).toBeTruthy();
    fireEvent.click(button('Keep current'));
    expect(calls.some((call) => call.key === 'PUT /api/sheet')).toBe(false);
    pick('Gimli.pdf');
    reader.openSheet.mockResolvedValue(handle({ pages: 5 }));
    fireEvent.click(button('Replace'));
    expect(await screen.findByText('5 pages')).toBeTruthy();
    expect(opened.close).toHaveBeenCalled();
    expect(screen.getByText('Gimli.pdf')).toBeTruthy();
  });

  it('asks before removing the sheet', async () => {
    const { calls, opened } = await openSheet({ 'DELETE /api/sheet': () => empty() });
    fireEvent.click(button('Remove'));
    fireEvent.click(button('Keep'));
    expect(calls.some((call) => call.key === 'DELETE /api/sheet')).toBe(false);
    fireEvent.click(button('Remove'));
    expect(screen.getByText('Remove Thorin.pdf and everything filled in on it?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(await screen.findByText(/Upload a character sheet PDF/)).toBeTruthy();
    expect(opened.close).toHaveBeenCalled();
    expect(calls.find((call) => call.key === 'DELETE /api/sheet').init.headers).toEqual({ 'X-Requested-With': 'fetch' });
  });

  it('shows why the server refused to load, upload or remove a sheet', async () => {
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ error: 'The server answered 500.' }, 500),
    });
    show();
    expect((await screen.findByRole('alert')).textContent).toBe('The server answered 500.');
    cleanup();

    await openSheet({
      'PUT /api/sheet': () => json({ error: 'That file is not a PDF.' }, 400),
      'DELETE /api/sheet': () => json({ error: 'Gone wrong.' }, 500),
    });
    pick('notes.pdf');
    fireEvent.click(button('Replace'));
    expect((await screen.findByRole('alert')).textContent).toBe('That file is not a PDF.');
    fireEvent.click(button('Remove'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Gone wrong.'));
    expect(screen.getByText('2 pages')).toBeTruthy();
  });

  it('says when the PDF cannot be opened or prepared for download', async () => {
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ sheet: SHEET }),
      'GET /api/sheet/file': () => new Response('', { status: 404, statusText: 'Not Found' }),
    });
    show();
    expect((await screen.findByRole('alert')).textContent).toBe('That PDF could not be opened.');
    expect(button('Download').disabled).toBe(true);
    cleanup();

    reader.openSheet.mockRejectedValueOnce(new Error('Invalid PDF structure.'));
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ sheet: SHEET }),
      'GET /api/sheet/file': pdfResponse,
    });
    show();
    expect((await screen.findByRole('alert')).textContent).toBe('That PDF could not be opened.');
    cleanup();

    await openSheet({}, handle({ filled: vi.fn(async () => { throw new Error('worker gone'); }) }));
    fireEvent.click(button('Download'));
    expect((await screen.findByRole('alert')).textContent).toBe('The PDF could not be prepared for download.');
  });

  it('opens nothing when the tab closes while the PDF is still loading', async () => {
    let sendFile;
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ sheet: SHEET }),
      'GET /api/sheet/file': () => new Promise((resolve) => { sendFile = resolve; }),
    });
    const view = show();
    await waitFor(() => expect(sendFile).toBeTypeOf('function'));
    view.unmount();
    await act(async () => sendFile(pdfResponse()));
    await settle();
    expect(reader.openSheet).not.toHaveBeenCalled();
  });

  it('closes a reader that finishes opening after the tab has closed', async () => {
    let finishOpening;
    reader.openSheet.mockReturnValue(new Promise((resolve) => { finishOpening = resolve; }));
    serve({
      'GET /api/me': () => json(LOGGED_IN),
      'GET /api/dice': () => json({ sets: [] }),
      'GET /api/sheet': () => json({ sheet: SHEET }),
      'GET /api/sheet/file': pdfResponse,
    });
    const view = show();
    await waitFor(() => expect(reader.openSheet).toHaveBeenCalled());
    view.unmount();
    const late = handle();
    await act(async () => finishOpening(late));
    expect(late.close).toHaveBeenCalled();
  });
});

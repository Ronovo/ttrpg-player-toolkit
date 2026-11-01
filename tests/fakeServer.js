import { vi } from 'vitest';

export const PORTFOLIO = 'http://portfolio.test';
export const LOGGED_OUT = { enabled: true, username: null, portfolioUrl: PORTFOLIO, loginError: null };
export const LOGGED_IN = { ...LOGGED_OUT, username: 'ronovo' };

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const empty = () => new Response(null, { status: 204 });

// Stands in for the server: answers by "METHOD url" and keeps every request made.
export function serve(routes) {
  const calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    calls.push({ key, init });
    if (!routes[key]) return json({ error: `no route for ${key}` }, 404);
    return routes[key](init);
  });
  return calls;
}

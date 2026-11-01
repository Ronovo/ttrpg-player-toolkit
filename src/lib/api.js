// Calls that change something carry this header; a form on another site cannot add it.
export const SAME_SITE_HEADERS = { "X-Requested-With": "fetch" };

// A call to this site's server. Resolves to the JSON answer, or null for an empty one, and rejects with the
// server's reason when it refuses.
export async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, { method, body, headers: method === "GET" ? {} : SAME_SITE_HEADERS });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `The server answered ${response.status}.`);
  return data;
}

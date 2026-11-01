import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const LOGGED_OUT = { enabled: false, username: null, portfolioUrl: null, loginError: null };
const PORTFOLIO_TIMEOUT_MS = 5000;

// Without a provider, as in a component rendered on its own, the page is logged out and nothing calls the actions.
const AccountContext = createContext({ account: LOGGED_OUT, loginLabel: "", customSets: [] });

// Who is logged in with a portfolio account, and that account's uploaded dice sets, for the whole page.
export function AccountProvider({ children }) {
  const [account, setAccount] = useState(LOGGED_OUT);
  const [portfolioName, setPortfolioName] = useState(null);
  const [customSets, setCustomSets] = useState([]);

  useEffect(() => {
    api("/api/me").then(setAccount).catch(() => {});
  }, []);

  // Names the portfolio account this browser is logged in to over there, when the portfolio says who that is.
  useEffect(() => {
    if (!account.enabled || account.username) return;
    fetch(`${account.portfolioUrl}/sso/me`, { credentials: "include", signal: AbortSignal.timeout(PORTFOLIO_TIMEOUT_MS) })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => setPortfolioName(data.username ?? null))
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    if (!account.username) {
      setCustomSets([]);
      return;
    }
    api("/api/dice").then((data) => setCustomSets(data.sets)).catch(() => {});
  }, [account.username]);

  const value = useMemo(() => ({
    account,
    customSets,
    loginLabel: portfolioName ? `Log in as ${portfolioName}` : "Log in with portfolio account",
    async logout() {
      await api("/api/logout", { method: "POST" });
      setAccount((current) => ({ ...current, username: null }));
    },
    async uploadSet(form) {
      const set = await api("/api/dice", { method: "POST", body: form });
      setCustomSets((current) => [...current, set]);
    },
    async deleteSet(id) {
      await api(`/api/dice/${id}`, { method: "DELETE" });
      setCustomSets((current) => current.filter((set) => set.id !== id));
    },
  }), [account, customSets, portfolioName]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export default function useAccount() {
  return useContext(AccountContext);
}

import useAccount from "../hooks/useAccount.jsx";

export function LoginLink() {
  const { loginLabel } = useAccount();
  return <a className="secondary account" href="/sso/login">{loginLabel}</a>;
}

// The portfolio login link, or the logged-in account with its Log out, when the server offers login.
export default function AccountMenu() {
  const { account, logout } = useAccount();
  if (!account.enabled) return null;
  return account.username ? (
    <button type="button" className="secondary account" onClick={logout}>{account.username}: Log out</button>
  ) : (
    <LoginLink />
  );
}

import Link from "next/link";

export function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">EGX Folio</Link>
      <Link href="/">Portfolio</Link>
      <Link href="/transactions">Transactions</Link>
      <Link href="/watchlist">Watchlist</Link>
    </nav>
  );
}

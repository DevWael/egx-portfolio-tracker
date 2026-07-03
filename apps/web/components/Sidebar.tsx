"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ path }: { path: string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  portfolio: "M12 3v9l6 3M21 12a9 9 0 1 1-9-9",
  tx: "M7 7h11l-3-3M17 17H6l3 3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 13h6M9 17h6",
};

const LINKS = [
  { href: "/", label: "Portfolio", icon: ICONS.portfolio },
  { href: "/transactions", label: "Transactions", icon: ICONS.tx },
  { href: "/watchlist", label: "Watchlist", icon: ICONS.eye, badgeKey: "watchlist" as const },
  { href: "/digest", label: "Digest", icon: ICONS.doc },
];

export function Sidebar({ watchlistBadge = 0 }: { watchlistBadge?: number }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" /> EGX Folio</div>
      <div className="menu-label">Menu</div>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`side-link${active ? " active" : ""}`}>
            <Icon path={l.icon} />
            {l.label}
            {l.badgeKey === "watchlist" && watchlistBadge > 0 ? <span className="side-badge">{watchlistBadge}</span> : null}
          </Link>
        );
      })}
      <div className="side-foot">
        <span className="avatar">YOU</span>
        <div>
          <div className="who">Your Portfolio</div>
          <div className="sub">Personal account</div>
        </div>
      </div>
    </aside>
  );
}

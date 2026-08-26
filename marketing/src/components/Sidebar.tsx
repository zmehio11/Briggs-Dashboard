"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Health Score" },
  { href: "/revenue", label: "Revenue & Covers" },
  { href: "/attribution", label: "Marketing Attribution" },
  { href: "/social", label: "Social Performance" },
  { href: "/reviews", label: "Review Sentiment" },
  { href: "/campaigns", label: "Email / SMS Campaigns" },
  { href: "/visibility", label: "Local Visibility" },
  { href: "/promos", label: "Promo Performance" },
  { href: "/segments", label: "Customer Segments" },
];

const ENGINE_LINKS = [
  { href: "/content-calendar", label: "Content Calendar" },
  { href: "/weekly-report", label: "Weekly Report" },
  { href: "/campaign-brief", label: "Campaign Brief" },
  { href: "/community-outreach", label: "Community Outreach" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-series-1/10 font-medium text-series-1" : "text-ink-secondary hover:bg-black/[0.03]"
      }`}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-hairline px-3 py-6">
      <div className="px-3 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Briggs</div>
        <div className="text-lg font-semibold">Marketing</div>
      </div>
      <ul className="space-y-0.5">
        {LINKS.map((link) => (
          <li key={link.href}>
            <NavLink {...link} active={pathname === link.href} />
          </li>
        ))}
      </ul>
      <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Marketing Engine</div>
      <ul className="mt-2 space-y-0.5">
        {ENGINE_LINKS.map((link) => (
          <li key={link.href}>
            <NavLink {...link} active={pathname === link.href} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

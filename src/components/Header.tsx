import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/rooting", label: "Rooting Guide" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/hedging", label: "Hedging" },
  { href: "/about", label: "About" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-white tracking-tight"
          >
            <span className="text-blue-400 text-xl">🏀</span>
            <span className="hidden sm:inline">March Madness 2026</span>
            <span className="sm:hidden">MM26</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

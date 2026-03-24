import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "March Madness 2026 | Bracket Odds Tracker",
  description:
    "Live odds, standings, and rooting guide for the 2026 March Madness bracket pool.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mt-16 border-t border-slate-800 py-6 text-center text-sm text-slate-500">
          March Madness 2026 · Bracket Odds Tracker · All probabilities assume
          equal-weight outcomes
        </footer>
      </body>
    </html>
  );
}

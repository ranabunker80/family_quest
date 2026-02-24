"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { id: "overview", label: "👨‍👩‍👧‍👦 Familia", href: "/parent" },
  { id: "notes", label: "💬 Notas", href: "/parent?tab=notes" },
  { id: "content", label: "📚 Contenido", href: "/parent?tab=content" },
  { id: "focus", label: "🎯 Enfoque", href: "/parent?tab=focus" },
];

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Back */}
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium hidden sm:inline">
                Volver
              </span>
            </Link>

            {/* Title */}
            <h1 className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-teal-400 bg-clip-text text-transparent">
              Panel de Padres
            </h1>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-lg">{mobileMenuOpen ? "✕" : "☰"}</span>
            </button>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-2">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.id === "overview"
                    ? pathname === "/parent" &&
                      !globalThis.location?.search
                    : globalThis.location?.search?.includes(
                        `tab=${item.id}`
                      );

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40"
                        : "text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 space-y-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}

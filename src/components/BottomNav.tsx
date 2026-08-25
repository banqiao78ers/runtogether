"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "揪團" },
  { href: "/runs/new", label: "開團" },
  { href: "/me", label: "我的" },
];

export function BottomNav() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/banned")
  ) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/40 bg-[#0c1812]/95 backdrop-blur">
      <ul className="mx-auto flex h-14 max-w-lg items-stretch">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex h-full items-center justify-center text-sm font-medium ${
                  active ? "text-emerald-300" : "text-emerald-100/45"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

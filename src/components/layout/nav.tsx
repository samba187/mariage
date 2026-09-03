"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, LayoutGrid, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Tableau de bord", short: "Bord", icon: LayoutDashboard },
  { href: "/vendors", label: "Prestataires", short: "Presta", icon: Receipt },
  { href: "/guests", label: "Invités", short: "Invités", icon: Users },
  { href: "/floorplan", label: "Plan de salle", short: "Salle", icon: LayoutGrid },
  { href: "/settings", label: "Paramètres", short: "Réglages", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Barre latérale (écrans larges) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-rose-100 text-rose-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Barre inférieure (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-rose-600" : "text-muted-foreground"
              )}
            >
              <link.icon className="size-5" />
              {link.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

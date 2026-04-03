"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@autoerebus/ui/lib/utils";

const tabs = [
  { href: "/inventory", label: "Vehicule" },
  { href: "/inventory/properties", label: "Proprietati" },
  { href: "/inventory/autovit", label: "Autovit" },
];

export function InventoryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b bg-background px-1">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/inventory"
            ? pathname === "/inventory" ||
              pathname.startsWith("/inventory/new") ||
              /^\/inventory\/[^/]+$/.test(pathname) &&
                !["makes", "models", "properties"].some((s) =>
                  pathname.startsWith(`/inventory/${s}`)
                )
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors hover:text-foreground",
              isActive
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

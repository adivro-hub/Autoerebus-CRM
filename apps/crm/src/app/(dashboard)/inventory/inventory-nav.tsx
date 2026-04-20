"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@autoerebus/ui/lib/utils";

const baseTabs = [
  { href: "/inventory", label: "Vehicule" },
  { href: "/inventory/properties", label: "Proprietati" },
];

export function InventoryNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const userBrands = ((session?.user as { brands?: string[] })?.brands as string[]) || [];
  const isRestricted = userRole !== "SUPER_ADMIN" && userBrands.length > 0;
  const canAutovit = !isRestricted || userBrands.includes("AUTORULATE");

  const tabs = canAutovit
    ? [...baseTabs, { href: "/inventory/autovit", label: "Autovit" }]
    : baseTabs;

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
                : "text-gray-500"
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

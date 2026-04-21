"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  TrendingUp,
  Wrench,
  Shield,
  Calendar,
  Users,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Tags,
  Layers,
  SlidersHorizontal,
  List,
  ArrowUpDown,
  CarFront,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@autoerebus/ui/lib/utils";
import { BrandSwitcher, useBrand } from "./brand-switcher";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/inventory",
    label: "Inventar",
    icon: Car,
    children: [
      { href: "/inventory", label: "Vehicule", icon: List },
      { href: "/inventory/properties", label: "Proprietati", icon: SlidersHorizontal },
      { href: "/sync", label: "Sincronizare", icon: ArrowUpDown },
    ],
  },
  {
    href: "/sales",
    label: "Vanzari",
    icon: TrendingUp,
    children: [
      { href: "/sales", label: "Pipeline", icon: TrendingUp },
      { href: "/test-drives", label: "Test Drive", icon: Calendar },
      { href: "/showroom", label: "Intalniri Showroom", icon: Building2 },
      { href: "/demo-bookings", label: "Masini Demo", icon: CarFront },
    ],
  },
  {
    href: "/service",
    label: "Service",
    icon: Wrench,
    children: [
      { href: "/service", label: "Comenzi service", icon: Wrench },
      { href: "/service/offers", label: "Oferte", icon: Wrench },
    ],
  },
  { href: "/claims", label: "Daune", icon: Shield },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/users", label: "Utilizatori", icon: UserCog },
  { href: "/settings", label: "Setari", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { selectedBrand } = useBrand();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userBrands: string[] = ((session?.user as any)?.brands as string[]) || [];
  const isRestricted = userRole !== "SUPER_ADMIN" && userBrands.length > 0;
  const hasService = !isRestricted || userBrands.includes("SERVICE");
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  const isManagerOrAbove = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER";
  const canAutorulate = !isRestricted || userBrands.includes("AUTORULATE");

  // Filter nav items based on user permissions
  const navItems = NAV_ITEMS
    .filter((item) => {
      if ((item.href === "/service" || item.href === "/claims") && !hasService) return false;
      if (item.href === "/users" && !isAdmin) return false;
      if ((item.href === "/customers" || item.href === "/settings") && !isManagerOrAbove) return false;
      return true;
    })
    // Filter children (e.g., Inventar → Sincronizare only for AUTORULATE)
    .map((item) => {
      if (!item.children) return item;
      const filteredChildren = item.children.filter((child) => {
        if (child.href === "/sync" && !canAutorulate) return false;
        return true;
      });
      return { ...item, children: filteredChildren };
    });

  const [collapsed, setCollapsed] = useState(false);

  // Append brand param to nav links
  const withBrand = (href: string) => {
    if (selectedBrand && selectedBrand !== "ALL") {
      return `${href}?brand=${selectedBrand}`;
    }
    return href;
  };
  const [expandedItems, setExpandedItems] = useState<string[]>([
    // Auto-expand if user is on an inventory page
    ...(pathname.startsWith("/inventory") ? ["/inventory"] : []),
  ]);

  function toggleExpand(href: string) {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">A</span>
            </div>
            <div>
              <h1 className="font-heading text-sm font-bold text-sidebar-foreground">
                Autoerebus
              </h1>
              <p className="text-sm text-gray-500">CRM Platform</p>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link
            href="/dashboard"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
          >
            <span className="text-sm font-bold text-primary-foreground">A</span>
          </Link>
        )}
      </div>

      {/* Brand Switcher */}
      {!collapsed && (
        <div className="border-b px-3 py-3">
          <BrandSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-thin">
        {navItems.map((item) => {
          const isActive =
            item.children
              ? pathname.startsWith(item.href)
              : pathname === item.href;
          const isExpanded = expandedItems.includes(item.href);
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.href}>
              {hasChildren ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </>
                    )}
                  </button>
                  {!collapsed && isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-3">
                      {item.children!.map((child) => {
                        const isChildActive =
                          child.href === "/inventory"
                            ? pathname === "/inventory" || pathname === "/inventory/new"
                            : pathname.startsWith(child.href);

                        return (
                          <Link
                            key={child.href}
                            href={withBrand(child.href)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                              isChildActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <child.icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={withBrand(item.href)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-gray-500 shadow-sm hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

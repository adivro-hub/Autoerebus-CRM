"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
});

const useSidebar = () => React.useContext(SidebarContext);

/* ------------------------------------------------------------------ */
/*  SidebarProvider                                                    */
/* ------------------------------------------------------------------ */

interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

function SidebarProvider({
  children,
  defaultCollapsed = false,
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const value = React.useMemo(
    () => ({ collapsed, setCollapsed }),
    [collapsed]
  );
  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsible?: boolean;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, collapsible = true, children, ...props }, ref) => {
    const { collapsed, setCollapsed } = useSidebar();

    return (
      <aside
        ref={ref}
        data-collapsed={collapsed}
        className={cn(
          "group/sidebar relative flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          className
        )}
        {...props}
      >
        {children}
        {collapsible && (
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </aside>
    );
  }
);
Sidebar.displayName = "Sidebar";

/* ------------------------------------------------------------------ */
/*  SidebarHeader (brand switcher area)                                */
/* ------------------------------------------------------------------ */

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebar();
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center border-b px-4 py-4",
        collapsed && "justify-center px-2",
        className
      )}
      {...props}
    />
  );
});
SidebarHeader.displayName = "SidebarHeader";

/* ------------------------------------------------------------------ */
/*  SidebarContent                                                     */
/* ------------------------------------------------------------------ */

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-y-auto py-2", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

/* ------------------------------------------------------------------ */
/*  SidebarFooter                                                      */
/* ------------------------------------------------------------------ */

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-t p-4", className)}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

/* ------------------------------------------------------------------ */
/*  SidebarSection (collapsible group)                                 */
/* ------------------------------------------------------------------ */

interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  (
    { className, title, defaultOpen = true, collapsible = true, children, ...props },
    ref
  ) => {
    const [open, setOpen] = React.useState(defaultOpen);
    const { collapsed: sidebarCollapsed } = useSidebar();

    return (
      <div ref={ref} className={cn("px-3 py-2", className)} {...props}>
        {title && !sidebarCollapsed && (
          <button
            onClick={collapsible ? () => setOpen((o) => !o) : undefined}
            className={cn(
              "flex w-full items-center gap-1 px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50",
              collapsible && "cursor-pointer hover:text-sidebar-foreground/80"
            )}
          >
            {collapsible && (
              open ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            )}
            {title}
          </button>
        )}
        {(open || sidebarCollapsed) && (
          <nav className="flex flex-col gap-0.5">{children}</nav>
        )}
      </div>
    );
  }
);
SidebarSection.displayName = "SidebarSection";

/* ------------------------------------------------------------------ */
/*  SidebarItem                                                        */
/* ------------------------------------------------------------------ */

interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  badge?: React.ReactNode;
}

const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, icon, active, badge, children, ...props }, ref) => {
    const { collapsed } = useSidebar();

    return (
      <button
        ref={ref}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active &&
            "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
          collapsed && "justify-center px-0",
          className
        )}
        {...props}
      >
        {icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{children}</span>
            {badge && <span className="ml-auto">{badge}</span>}
          </>
        )}
      </button>
    );
  }
);
SidebarItem.displayName = "SidebarItem";

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSection,
  SidebarItem,
  useSidebar,
};

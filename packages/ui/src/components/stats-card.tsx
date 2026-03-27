"use client";

import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

export interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  loading?: boolean;
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  (
    { className, icon, label, value, change, changeLabel, loading = false, ...props },
    ref
  ) => {
    const isPositive = change !== undefined && change >= 0;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
          className
        )}
        {...props}
      >
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-8 rounded bg-muted" />
            </div>
            <div className="h-8 w-20 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              {icon && (
                <div className="text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
                  {icon}
                </div>
              )}
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">{value}</p>
            </div>
            {change !== undefined && (
              <div className="mt-1 flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {change}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
StatsCard.displayName = "StatsCard";

export { StatsCard };

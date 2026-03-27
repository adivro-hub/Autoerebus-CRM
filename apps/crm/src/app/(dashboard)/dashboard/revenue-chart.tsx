"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Oct", vanzari: 185000, service: 42000 },
  { month: "Nov", vanzari: 210000, service: 38000 },
  { month: "Dec", vanzari: 245000, service: 51000 },
  { month: "Ian", vanzari: 178000, service: 45000 },
  { month: "Feb", vanzari: 225000, service: 48000 },
  { month: "Mar", vanzari: 267000, service: 52000 },
];

export function RevenueChart() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorVanzari" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorService" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value: number) =>
              `${(value / 1000).toFixed(0)}k`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) =>
              new Intl.NumberFormat("ro-RO", {
                style: "currency",
                currency: "EUR",
                minimumFractionDigits: 0,
              }).format(value)
            }
          />
          <Area
            type="monotone"
            dataKey="vanzari"
            stroke="hsl(221, 83%, 53%)"
            fillOpacity={1}
            fill="url(#colorVanzari)"
            name="Vanzari"
          />
          <Area
            type="monotone"
            dataKey="service"
            stroke="hsl(142, 76%, 36%)"
            fillOpacity={1}
            fill="url(#colorService)"
            name="Service"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

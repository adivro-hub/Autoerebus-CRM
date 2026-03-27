import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import { Car, Users, TrendingUp, Wrench, Plus, FileText, Phone, CalendarPlus } from "lucide-react";
import { RevenueChart } from "./revenue-chart";

export const metadata = {
  title: "Dashboard",
};

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const firstName = session?.user?.firstName ?? "Utilizator";
  const brand = params.brand && params.brand !== "ALL" ? params.brand : undefined;

  // Build brand filter for entities that have a brand field
  const brandWhere = brand ? { brand: brand as any } : {};

  let vehicleCount = 0;
  let leadCount = 0;
  let dealCount = 0;
  let serviceCount = 0;
  let totalRevenue = 0;

  try {
    const [vehicles, leads, deals, services, revenue] = await Promise.all([
      prisma.vehicle.count({ where: { status: "AVAILABLE", ...brandWhere } }),
      prisma.lead.count({
        where: {
          status: { in: ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION"] },
          ...brandWhere,
        },
      }),
      prisma.deal.count({ where: brandWhere }),
      prisma.serviceOrder.count({
        where: {
          status: { in: ["SCHEDULED", "RECEIVED", "IN_PROGRESS", "WAITING_PARTS"] },
          ...(brand ? { brand: brand as any } : {}),
        },
      }),
      prisma.deal.aggregate({
        where: {
          stage: { name: "Câștigat" },
          ...brandWhere,
        },
        _sum: { value: true },
      }),
    ]);

    vehicleCount = vehicles;
    leadCount = leads;
    dealCount = deals;
    serviceCount = services;
    totalRevenue = revenue._sum.value ?? 0;
  } catch {
    // DB not available
  }

  // Recent activity from DB
  let recentActivities: Array<{
    id: string;
    text: string;
    time: Date;
  }> = [];

  try {
    const activities = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    recentActivities = activities.map((a) => ({
      id: a.id,
      text: `${a.action}: ${a.entity} ${a.entityId ? `#${a.entityId.slice(-6)}` : ""}${a.user ? ` - ${a.user.firstName} ${a.user.lastName}` : ""}`,
      time: a.createdAt,
    }));
  } catch {
    // Fallback
  }

  const stats = [
    {
      title: "Vehicule in Stoc",
      value: vehicleCount.toString(),
      change: brand ? `Filtrat: ${brand}` : "Toate brandurile",
      icon: Car,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Lead-uri Active",
      value: leadCount.toString(),
      change: brand ? `Filtrat: ${brand}` : "Toate brandurile",
      icon: Users,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "Dealuri in Derulare",
      value: dealCount.toString(),
      change: totalRevenue > 0 ? `~${formatCurrency(totalRevenue)} valoare` : "0 EUR valoare",
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "Comenzi Service",
      value: serviceCount.toString(),
      change: brand ? `Filtrat: ${brand}` : "Toate brandurile",
      icon: Wrench,
      color: "text-purple-600 bg-purple-100",
    },
  ];

  const quickActions = [
    { label: "Vehicul Nou", icon: Plus, href: "/inventory/new", color: "bg-blue-600 hover:bg-blue-700" },
    { label: "Lead Nou", icon: Users, href: "/sales?action=new-lead", color: "bg-green-600 hover:bg-green-700" },
    { label: "Comanda Service", icon: Wrench, href: "/service?action=new", color: "bg-purple-600 hover:bg-purple-700" },
    { label: "Test Drive", icon: CalendarPlus, href: "/test-drives?action=new", color: "bg-orange-600 hover:bg-orange-700" },
    { label: "Raport", icon: FileText, href: "/dashboard/reports", color: "bg-gray-600 hover:bg-gray-700" },
    { label: "Apel Client", icon: Phone, href: "/customers", color: "bg-teal-600 hover:bg-teal-700" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Buna ziua, {firstName}!
        </h1>
        <p className="text-muted-foreground">
          {brand
            ? `Vizualizare: ${brand}`
            : "Iata un sumar al activitatii tale de azi."}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Venituri - Ultimele 6 luni</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actiuni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className={`flex flex-col items-center gap-1.5 rounded-lg p-3 text-white transition-colors ${action.color}`}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{action.label}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activitate Recenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nicio activitate recenta.</p>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <p className="text-sm">{activity.text}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {activity.time.toLocaleString("ro-RO")}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

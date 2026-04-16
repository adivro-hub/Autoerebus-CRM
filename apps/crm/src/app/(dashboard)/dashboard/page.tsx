export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import { Car, Users, TrendingUp, Wrench, Plus, FileText, Phone, CalendarPlus, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
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
  let newLeadCount = 0;
  let testDriveCount = 0;
  let pipelineValue = 0;
  let wonCount = 0;
  let wonValue = 0;

  try {
    const [vehicles, newLeads, testDrives, pipeline, won] = await Promise.all([
      prisma.vehicle.count({ where: { status: "IN_STOCK", ...brandWhere } }),
      prisma.lead.count({
        where: {
          status: "NEW",
          ...brandWhere,
        },
      }),
      prisma.testDrive.count({
        where: {
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          ...brandWhere,
        },
      }),
      prisma.deal.aggregate({
        where: {
          stage: { name: { notIn: ["Vândut", "Câștigat", "Pierdut"] } },
          ...brandWhere,
        },
        _sum: { value: true },
        _count: true,
      }),
      prisma.deal.aggregate({
        where: {
          stage: { name: { in: ["Vândut", "Câștigat"] } },
          ...brandWhere,
        },
        _sum: { value: true },
        _count: true,
      }),
    ]);

    vehicleCount = vehicles;
    newLeadCount = newLeads;
    testDriveCount = testDrives;
    pipelineValue = pipeline._sum.value ?? 0;
    wonCount = won._count ?? 0;
    wonValue = won._sum.value ?? 0;
  } catch {
    // DB not available
  }

  // Recent activity from DB
  let recentActivities: Array<{
    id: string;
    text: string;
    time: Date;
    type: string;
  }> = [];

  try {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { firstName: true, lastName: true } },
        lead: {
          select: {
            customer: { select: { firstName: true, lastName: true } },
            brand: true,
          },
        },
      },
    });

    recentActivities = activities.map((a: { id: string; type: string; content: string; createdAt: Date; user: { firstName: string; lastName: string } | null; lead: { customer: { firstName: string; lastName: string }; brand: string } | null }) => {
      const customerName = a.lead?.customer ? `${a.lead.customer.firstName} ${a.lead.customer.lastName}` : "";
      const agentName = a.user ? `${a.user.firstName} ${a.user.lastName}` : "Sistem";
      const brandTag = a.lead?.brand ? `[${a.lead.brand}]` : "";

      let text = "";
      switch (a.type) {
        case "CREATED":
          text = `${brandTag} Lead nou: ${customerName}`;
          break;
        case "STAGE_CHANGE":
          text = `${brandTag} ${customerName} — ${a.content}`;
          break;
        case "NOTE":
          text = `${brandTag} ${agentName}: ${a.content.slice(0, 60)}${a.content.length > 60 ? "..." : ""}`;
          break;
        case "TEST_DRIVE":
          text = `${brandTag} Test Drive: ${customerName} — ${a.content.slice(0, 50)}`;
          break;
        default:
          text = `${brandTag} ${a.content.slice(0, 60)}`;
      }

      return { id: a.id, text, time: a.createdAt, type: a.type };
    });
  } catch {
    // Fallback
  }

  const stats = [
    {
      title: "Lead-uri Noi",
      value: newLeadCount.toString(),
      change: newLeadCount > 0 ? "Necesită atenție" : "Niciun lead nou",
      icon: Users,
      color: newLeadCount > 0 ? "text-red-600 bg-red-100" : "text-green-600 bg-green-100",
      href: "/sales?tab=leads",
    },
    {
      title: "Test Drive-uri",
      value: testDriveCount.toString(),
      change: testDriveCount > 0 ? `${testDriveCount} programări active` : "Nicio programare",
      icon: Car,
      color: "text-cyan-600 bg-cyan-100",
      href: "/test-drives",
    },
    {
      title: "Pipeline Activ",
      value: pipelineValue > 0 ? formatCurrency(pipelineValue) : "0 €",
      change: `${vehicleCount} vehicule în stoc`,
      icon: TrendingUp,
      color: "text-orange-600 bg-orange-100",
      href: "/sales?tab=pipeline",
    },
    {
      title: "Vândute",
      value: wonCount.toString(),
      change: wonValue > 0 ? `${formatCurrency(wonValue)} total` : "0 € total",
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-100",
      href: "/sales?tab=pipeline",
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
        <h1 className="font-heading text-base font-bold tracking-tight">
          Buna ziua, {firstName}!
        </h1>
        <p className="text-gray-500">
          {brand
            ? `Vizualizare: ${brand}`
            : "Iata un sumar al activitatii tale de azi."}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <a key={stat.title} href={stat.href} className="block transition-transform hover:scale-[1.02]">
            <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">{stat.title}</p>
                    <p className="text-base font-bold">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.change}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
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
                  <span className="text-sm font-medium">{action.label}</span>
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
              <p className="text-sm text-gray-500">Nicio activitate recenta.</p>
            ) : (
              recentActivities.map((activity) => {
                const typeStyles: Record<string, { icon: typeof Car; color: string }> = {
                  CREATED: { icon: Sparkles, color: "text-green-500" },
                  STAGE_CHANGE: { icon: ArrowRight, color: "text-blue-500" },
                  NOTE: { icon: MessageSquare, color: "text-gray-500" },
                  TEST_DRIVE: { icon: Car, color: "text-cyan-500" },
                };
                const style = typeStyles[activity.type] || typeStyles["NOTE"];
                const Icon = style!.icon;
                const color = style!.color;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    <p className="flex-1 text-sm">{activity.text}</p>
                    <span className="shrink-0 text-sm text-gray-500">
                      {activity.time.toLocaleString("ro-RO")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

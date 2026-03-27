export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatDateTime } from "@autoerebus/ui/lib/utils";
import { Plus, Calendar, Clock, User, Car } from "lucide-react";

export const metadata = {
  title: "Test Drive",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "Programat", variant: "outline" },
  CONFIRMED: { label: "Confirmat", variant: "default" },
  IN_PROGRESS: { label: "In Desfasurare", variant: "default" },
  COMPLETED: { label: "Finalizat", variant: "secondary" },
  CANCELLED: { label: "Anulat", variant: "destructive" },
  NO_SHOW: { label: "Neprezentare", variant: "destructive" },
};

interface PageProps {
  searchParams: Promise<{ brand?: string; date?: string; status?: string }>;
}

export default async function TestDrivesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let testDrives: Array<{
    id: string;
    scheduledAt: Date;
    duration: number;
    status: string;
    brand: string;
    notes: string | null;
    feedback: string | null;
    customer: { firstName: string; lastName: string; phone: string | null };
    vehicle: { make: { name: string }; model: { name: string }; year: number };
    agent: { firstName: string; lastName: string } | null;
  }> = [];

  try {
    const where: Record<string, unknown> = {};
    if (params.brand && params.brand !== "ALL") where.brand = params.brand;
    if (params.status) where.status = params.status;
    if (params.date) {
      const date = new Date(params.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduledAt = { gte: date, lt: nextDay };
    }

    const testDrivesResult = await prisma.testDrive.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
          select: { make: true, model: true, year: true },
        } as any,
        agent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    testDrives = testDrivesResult as unknown as typeof testDrives;
  } catch {
    // DB not available
  }

  // Group by date
  const grouped = testDrives.reduce<Record<string, typeof testDrives>>(
    (acc, td) => {
      const key = td.scheduledAt.toISOString().split("T")[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(td);
      return acc;
    },
    {}
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Test Drive
          </h1>
          <p className="text-sm text-muted-foreground">
            {testDrives.length} programari
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Programeaza Test Drive
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="date"
          defaultValue={params.date}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          defaultValue={params.status ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toate statusurile</option>
          {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Schedule List */}
      {testDrives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="mb-3 h-10 w-10" />
            <p className="font-medium">Nicio programare gasita</p>
            <p className="text-sm">Programati un test drive nou</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([date, drives]) => (
          <div key={date} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4" />
              {date === today ? "Azi" : new Date(date).toLocaleDateString("ro-RO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              <Badge variant="secondary">{drives.length}</Badge>
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drives.map((td) => {
                const statusInfo = STATUS_LABELS[td.status] ?? {
                  label: td.status,
                  variant: "outline" as const,
                };

                return (
                  <Card key={td.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatDateTime(td.scheduledAt)}
                          </span>
                        </div>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {td.customer.firstName} {td.customer.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {td.vehicle.make.name} {td.vehicle.model.name} ({td.vehicle.year})
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{td.duration} min</span>
                        {td.agent && (
                          <span>
                            Agent: {td.agent.firstName} {td.agent.lastName}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

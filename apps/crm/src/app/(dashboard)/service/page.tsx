export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency, formatDate } from "@autoerebus/ui/lib/utils";
import { SERVICE_PIPELINE_STAGES } from "@autoerebus/types";
import { Plus, Wrench } from "lucide-react";

export const metadata = {
  title: "Service",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "Programat", variant: "outline" },
  RECEIVED: { label: "Receptionat", variant: "secondary" },
  IN_PROGRESS: { label: "In Lucru", variant: "default" },
  WAITING_PARTS: { label: "Asteptare Piese", variant: "destructive" },
  COMPLETED: { label: "Finalizat", variant: "default" },
  DELIVERED: { label: "Livrat", variant: "secondary" },
  CANCELLED: { label: "Anulat", variant: "destructive" },
};

interface PageProps {
  searchParams: Promise<{ brand?: string; status?: string; page?: string }>;
}

export default async function ServicePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 20;

  let orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    type: string | null;
    description: string | null;
    scheduledDate: Date | null;
    estimatedCost: number | null;
    actualCost: number | null;
    currency: string;
    customer: { firstName: string; lastName: string; phone: string | null };
    vehicle: { make: { name: string }; model: { name: string }; year: number } | null;
    assignedTo: { firstName: string; lastName: string } | null;
  }> = [];
  let total = 0;

  try {
    const where: Record<string, unknown> = {};
    if (params.brand && params.brand !== "ALL") where.brand = params.brand;
    if (params.status) where.status = params.status;

    const [ordersResult, totalResult] = await Promise.all([
      prisma.serviceOrder.findMany({
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
          assignedTo: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.serviceOrder.count({ where }),
    ]);
    orders = ordersResult as unknown as typeof orders;
    total = totalResult;
  } catch {
    // DB not available
  }

  // Pipeline view
  const stageGroups = SERVICE_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    orders: orders.filter((o) => {
      const statusMap: Record<string, string> = {
        Programat: "SCHEDULED",
        Receptionat: "RECEIVED",
        "In Lucru": "IN_PROGRESS",
        "Asteptare Piese": "WAITING_PARTS",
        Finalizat: "COMPLETED",
        Livrat: "DELIVERED",
      };
      return o.status === statusMap[stage.name];
    }),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Comenzi Service
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} comenzi in total
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Comanda Noua
        </Button>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stageGroups.map((stage) => (
          <div
            key={stage.name}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50"
          >
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-sm font-semibold">{stage.name}</h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {stage.orders.length}
              </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {stage.orders.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                  Nicio comanda
                </div>
              ) : (
                stage.orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-mono text-muted-foreground">
                          #{order.orderNumber.slice(-8)}
                        </p>
                        {order.type && (
                          <Badge variant="outline" className="text-[10px]">
                            {order.type}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      {order.vehicle && (
                        <p className="text-xs text-muted-foreground">
                          {order.vehicle.make.name} {order.vehicle.model.name} ({order.vehicle.year})
                        </p>
                      )}
                      {order.scheduledDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Programat: {formatDate(order.scheduledDate)}
                        </p>
                      )}
                      {(order.estimatedCost || order.actualCost) && (
                        <p className="mt-1 text-xs font-medium">
                          {order.actualCost
                            ? formatCurrency(order.actualCost, order.currency)
                            : `~${formatCurrency(order.estimatedCost!, order.currency)}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

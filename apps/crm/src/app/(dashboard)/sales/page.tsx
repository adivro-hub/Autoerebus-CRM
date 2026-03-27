import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import { SALES_PIPELINE_STAGES } from "@autoerebus/types";
import { Plus, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Vanzari",
};

const STAGE_COLORS: Record<string, string> = {
  "Lead Nou": "border-l-blue-500",
  Contactat: "border-l-violet-500",
  Calificat: "border-l-amber-500",
  "Oferta Trimisa": "border-l-orange-500",
  Negociere: "border-l-red-500",
  Castigat: "border-l-emerald-500",
  Pierdut: "border-l-gray-500",
};

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function SalesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let stages: Array<{
    id: string;
    name: string;
    order: number;
    color: string;
    deals: Array<{
      id: string;
      value: number | null;
      currency: string;
      probability: number;
      lead: {
        customer: { firstName: string; lastName: string };
        vehicle: { make: { name: string }; model: { name: string } } | null;
      };
      assignedTo: { firstName: string; lastName: string } | null;
    }>;
  }> = [];

  try {
    const where: Record<string, unknown> = { pipelineType: "SALES" };
    if (params.brand && params.brand !== "ALL") {
      where.brand = params.brand;
    }

    stages = await prisma.pipelineStage.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        deals: {
          include: {
            lead: {
              include: {
                customer: { select: { firstName: true, lastName: true } },
                vehicle: {
                  include: {
                    make: { select: { name: true } },
                    model: { select: { name: true } },
                  },
                },
              },
            },
            assignedTo: { select: { firstName: true, lastName: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }) as typeof stages;
  } catch {
    // Use default stages if DB unavailable
    stages = SALES_PIPELINE_STAGES.map((s) => ({
      id: s.name,
      name: s.name,
      order: s.order,
      color: s.color,
      deals: [],
    }));
  }

  const totalValue = stages.reduce(
    (sum, stage) =>
      sum + stage.deals.reduce((s, d) => s + (d.value ?? 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Pipeline Vanzari
          </h1>
          <p className="text-sm text-muted-foreground">
            {stages.reduce((sum, s) => sum + s.deals.length, 0)} dealuri active
            &middot; Valoare totala: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Lead Nou
        </Button>
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-sm font-semibold">{stage.name}</h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {stage.deals.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 p-2">
              {stage.deals.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                  Niciun deal
                </div>
              ) : (
                stage.deals.map((deal) => (
                  <Card
                    key={deal.id}
                    className={`border-l-4 ${STAGE_COLORS[stage.name] ?? "border-l-gray-300"}`}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">
                        {deal.lead.customer.firstName}{" "}
                        {deal.lead.customer.lastName}
                      </p>
                      {deal.lead.vehicle && (
                        <p className="text-xs text-muted-foreground">
                          {deal.lead.vehicle.make.name}{" "}
                          {deal.lead.vehicle.model.name}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {deal.value
                            ? formatCurrency(deal.value, deal.currency)
                            : "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {deal.probability}%
                        </span>
                      </div>
                      {deal.assignedTo && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Agent: {deal.assignedTo.firstName}{" "}
                          {deal.assignedTo.lastName}
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

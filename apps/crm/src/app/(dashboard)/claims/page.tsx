export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency, formatDate } from "@autoerebus/ui/lib/utils";
import { CLAIMS_PIPELINE_STAGES } from "@autoerebus/types";
import { Plus, Shield } from "lucide-react";

export const metadata = {
  title: "Daune",
};

const STATUS_MAP: Record<string, string> = {
  Deschis: "OPENED",
  "Documente Necesare": "DOCUMENTS_PENDING",
  "In Analiza": "UNDER_REVIEW",
  Aprobat: "APPROVED",
  "In Reparatie": "IN_REPAIR",
  Finalizat: "COMPLETED",
  Respins: "REJECTED",
};

interface PageProps {
  searchParams: Promise<{ brand?: string; status?: string }>;
}

export default async function ClaimsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let claims: Array<{
    id: string;
    claimNumber: string;
    status: string;
    insuranceCompany: string | null;
    policyNumber: string | null;
    description: string | null;
    incidentDate: Date | null;
    estimatedCost: number | null;
    actualCost: number | null;
    currency: string;
    customer: { firstName: string; lastName: string };
    vehicle: { make: { name: string }; model: { name: string }; year: number } | null;
    assignedTo: { firstName: string; lastName: string } | null;
  }> = [];

  try {
    const where: Record<string, unknown> = {};
    // Claims don't have a direct brand field - filter via vehicle brand if set
    if (params.brand && params.brand !== "ALL") {
      where.vehicle = { brand: params.brand };
    }
    if (params.status) where.status = params.status;

    const claimsResult = await prisma.claim.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true } },
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
    });
    claims = claimsResult as unknown as typeof claims;
  } catch {
    // DB not available
  }

  // Group by status
  const stageGroups = CLAIMS_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    claims: claims.filter((c) => c.status === STATUS_MAP[stage.name]),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">
            Daune
          </h1>
          <p className="text-sm text-gray-500">
            {claims.length} dosare de daune
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Dosar Nou
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
              <Badge variant="secondary" className="text-sm">
                {stage.claims.length}
              </Badge>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {stage.claims.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-gray-500">
                  Niciun dosar
                </div>
              ) : (
                stage.claims.map((claim) => (
                  <Card key={claim.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-mono text-gray-500">
                          #{claim.claimNumber.slice(-8)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm font-medium">
                        {claim.customer.firstName} {claim.customer.lastName}
                      </p>
                      {claim.vehicle && (
                        <p className="text-sm text-gray-500">
                          {claim.vehicle.make.name} {claim.vehicle.model.name} ({claim.vehicle.year})
                        </p>
                      )}
                      {claim.insuranceCompany && (
                        <p className="mt-1 text-sm text-gray-500">
                          Asigurator: {claim.insuranceCompany}
                        </p>
                      )}
                      {claim.incidentDate && (
                        <p className="text-sm text-gray-500">
                          Incident: {formatDate(claim.incidentDate)}
                        </p>
                      )}
                      {(claim.estimatedCost || claim.actualCost) && (
                        <p className="mt-1 text-sm font-medium">
                          {claim.actualCost
                            ? formatCurrency(claim.actualCost, claim.currency)
                            : `~${formatCurrency(claim.estimatedCost!, claim.currency)}`}
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

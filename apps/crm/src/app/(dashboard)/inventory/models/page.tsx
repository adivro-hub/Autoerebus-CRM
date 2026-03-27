import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Layers } from "lucide-react";
import { ModelsClient } from "./models-client";

interface PageProps {
  searchParams: Promise<{
    make?: string;
  }>;
}

export default async function ModelsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const makeFilter = params.make ?? "";

  const where: Record<string, unknown> = {};
  if (makeFilter) {
    where.makeId = makeFilter;
  }

  let models: Array<{
    id: string;
    name: string;
    slug: string;
    makeId: string;
    make: { name: string };
    _count: { vehicles: number };
  }> = [];

  let makes: Array<{ id: string; name: string }> = [];

  try {
    [models, makes] = await Promise.all([
      prisma.vehicleModel.findMany({
        where,
        orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
        include: {
          make: { select: { name: true } },
          _count: { select: { vehicles: true } },
        },
      }),
      prisma.make.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  } catch {
    // Database not available
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Modele Auto
          </h1>
          <p className="text-sm text-muted-foreground">
            {models.length} modele{makeFilter ? " filtrate" : " in total"}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {models.length === 0 && !makeFilter ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Layers className="mb-3 h-10 w-10" />
              <p className="font-medium">Niciun model adaugat</p>
              <p className="text-sm">Adaugati primul model auto</p>
            </div>
          ) : null}
          <ModelsClient
            models={models}
            makes={makes}
            currentMakeId={makeFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}

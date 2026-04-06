import { prisma } from "@autoerebus/database";
import { Settings2 } from "lucide-react";
import { PropertiesClient } from "./properties-client";
import { MakesModelsSection } from "./makes-models-section";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  let properties: Array<{
    id: string;
    category: string;
    value: string;
    label: string;
    order: number;
    active: boolean;
  }> = [];

  let makes: Array<{
    id: string;
    name: string;
    slug: string;
    order: number;
    _count: { models: number; vehicles: number };
    models: Array<{ id: string; name: string; slug: string; _count: { vehicles: number } }>;
  }> = [];

  try {
    [properties, makes] = await Promise.all([
      prisma.carPropertyOption.findMany({
        orderBy: [{ category: "asc" }, { order: "asc" }, { label: "asc" }],
      }),
      prisma.make.findMany({
        orderBy: { order: "asc" },
        include: {
          _count: { select: { models: true, vehicles: true } },
          models: {
            orderBy: { name: "asc" },
            include: { _count: { select: { vehicles: true } } },
          },
        },
      }) as any,
    ]);
  } catch (error) {
    console.error("Properties DB error:", error);
  }

  const grouped: Record<
    string,
    Array<{
      id: string;
      category: string;
      value: string;
      label: string;
      order: number;
      active: boolean;
    }>
  > = {};

  for (const prop of properties) {
    if (!grouped[prop.category]) {
      grouped[prop.category] = [];
    }
    grouped[prop.category].push(prop);
  }

  const totalCount = properties.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">
            Proprietati Vehicule
          </h1>
          <p className="text-sm text-gray-500">
            {makes.length} marci, {makes.reduce((s, m) => s + m._count.models, 0)} modele, {totalCount} optiuni proprietati
          </p>
        </div>
      </div>

      {/* Makes & Models */}
      <MakesModelsSection makes={makes} />

      {/* Property Options */}
      {totalCount === 0 && Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Settings2 className="mb-3 h-10 w-10" />
          <p className="font-medium">Nicio proprietate adaugata</p>
          <p className="text-sm">
            Adaugati optiuni pentru tipuri de caroserie, combustibil, etc.
          </p>
        </div>
      ) : null}

      <PropertiesClient grouped={grouped} />
    </div>
  );
}

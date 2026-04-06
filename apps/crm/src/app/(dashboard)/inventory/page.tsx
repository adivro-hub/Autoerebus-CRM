export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Button } from "@autoerebus/ui/components/button";
import { Plus, Car } from "lucide-react";
import { InventoryFilters } from "./inventory-filters";
import { InventoryTable } from "./inventory-table";

interface PageProps {
  searchParams: Promise<{
    brand?: string;
    status?: string;
    condition?: string;
    page?: string;
    search?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 20;

  const where: Record<string, unknown> = {};
  if (params.brand && params.brand !== "ALL") {
    where.brand = params.brand;
  }
  if (params.status) {
    where.status = params.status;
  }
  if (params.condition) {
    where.condition = params.condition;
  }
  if (params.search) {
    where.OR = [
      { vin: { contains: params.search, mode: "insensitive" } },
      { make: { name: { contains: params.search, mode: "insensitive" } } },
      { model: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  let vehicles: Array<{
    id: string;
    year: number;
    price: number;
    currency: string;
    discountPrice: number | null;
    status: string;
    fuelType: string;
    mileage: number;
    brand: string;
    vin: string | null;
    specialBadge: boolean;
    specialBadgeText: string | null;
    externalSlug: string | null;
    make: { name: string; slug: string };
    model: { name: string; slug: string };
    agent: { firstName: string; lastName: string } | null;
  }> = [];
  let total = 0;

  try {
    [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          make: { select: { name: true, slug: true } },
          model: { select: { name: true, slug: true } },
          agent: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vehicle.count({ where }),
    ]);
  } catch {
    // Database not available - show empty state
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">Inventar</h1>
          <p className="text-sm text-gray-500">
            {total} vehicule in total
          </p>
        </div>
        <Link href="/inventory/new">
          <Button>
            <Plus className="h-4 w-4" />
            Adauga Vehicul
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <InventoryFilters />

      {/* Vehicle Table */}
      <Card>
        <CardContent className="p-0">
          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Car className="mb-3 h-10 w-10" />
              <p className="font-medium">Niciun vehicul gasit</p>
              <p className="text-sm">
                Adaugati un vehicul nou sau ajustati filtrele
              </p>
            </div>
          ) : (
            <InventoryTable vehicles={vehicles} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                Pagina {page} din {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/inventory?page=${page - 1}`}>
                    <Button variant="outline" size="sm">
                      Inapoi
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/inventory?page=${page + 1}`}>
                    <Button variant="outline" size="sm">
                      Inainte
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

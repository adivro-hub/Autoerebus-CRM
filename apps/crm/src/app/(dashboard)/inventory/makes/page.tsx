import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Tags } from "lucide-react";
import { MakesClient } from "./makes-client";

export default async function MakesPage() {
  let makes: Array<{
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    order: number;
    _count: { models: number; vehicles: number };
  }> = [];

  try {
    makes = await prisma.make.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { models: true, vehicles: true },
        },
      },
    });
  } catch {
    // Database not available
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">
            Marci Auto
          </h1>
          <p className="text-sm text-gray-500">
            {makes.length} marci in total
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {makes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Tags className="mb-3 h-10 w-10" />
              <p className="font-medium">Nicio marca adaugata</p>
              <p className="text-sm">Adaugati prima marca auto</p>
            </div>
          ) : null}
          <MakesClient makes={makes} />
        </CardContent>
      </Card>
    </div>
  );
}

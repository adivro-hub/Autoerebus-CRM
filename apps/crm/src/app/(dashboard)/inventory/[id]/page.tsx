import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from "@autoerebus/types";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";

export const metadata = {
  title: "Detalii Vehicul",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  IN_TRANSIT: { label: "In Tranzit", variant: "outline" },
  IN_STOCK: { label: "In Stoc", variant: "default" },
  RESERVED: { label: "Rezervat", variant: "secondary" },
  SOLD: { label: "Vandut", variant: "destructive" },
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: "Nou",
  USED: "Second-hand",
  DEMO: "Demo",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params;

  let vehicle: Awaited<ReturnType<typeof prisma.vehicle.findUnique>> & {
    make: { name: string };
    model: { name: string };
    images: Array<{ id: string; url: string; alt: string | null; order: number }>;
  } | null = null;

  try {
    vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        make: { select: { name: true } },
        model: { select: { name: true } },
        images: { orderBy: { order: "asc" } },
      },
    }) as typeof vehicle;
  } catch {
    notFound();
  }

  if (!vehicle) {
    notFound();
  }

  const statusInfo = STATUS_LABELS[vehicle.status] ?? {
    label: vehicle.status,
    variant: "outline" as const,
  };

  const details = [
    { label: "Marca", value: vehicle.make.name },
    { label: "Model", value: vehicle.model.name },
    { label: "An", value: vehicle.year.toString() },
    { label: "Combustibil", value: FUEL_TYPE_LABELS[vehicle.fuelType] ?? vehicle.fuelType },
    { label: "Transmisie", value: TRANSMISSION_LABELS[vehicle.transmission] ?? vehicle.transmission },
    { label: "Kilometraj", value: `${vehicle.mileage.toLocaleString("ro-RO")} km` },
    { label: "Stare", value: CONDITION_LABELS[vehicle.condition] ?? vehicle.condition },
    { label: "Brand", value: vehicle.brand },
    { label: "VIN", value: vehicle.vin ?? "-" },
    { label: "Putere", value: vehicle.horsepower ? `${vehicle.horsepower} CP` : "-" },
    { label: "Cilindree", value: vehicle.engineSize ? `${vehicle.engineSize} cm³` : "-" },
    { label: "Culoare", value: vehicle.color ?? "-" },
    { label: "Interior", value: vehicle.interiorColor ?? "-" },
    { label: "Usi", value: vehicle.doors?.toString() ?? "-" },
    { label: "Locuri", value: vehicle.seats?.toString() ?? "-" },
    { label: "Emisii CO2", value: vehicle.emissions ? `${vehicle.emissions} g/km` : "-" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">
                {vehicle.make.name} {vehicle.model.name} ({vehicle.year})
              </h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              VIN: {vehicle.vin ?? "Nespecificat"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/inventory/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4" />
              Editeaza
            </Button>
          </Link>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4" />
            Sterge
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Price Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pret</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(vehicle.price, vehicle.currency)}
            </p>
          </CardContent>
        </Card>

        {/* Images */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fotografii</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicle.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {vehicle.images.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-video overflow-hidden rounded-md bg-muted"
                  >
                    <img
                      src={img.url}
                      alt={img.alt ?? "Fotografie vehicul"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nicio fotografie adaugata
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Specificatii</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {details.map((detail) => (
              <div key={detail.label}>
                <p className="text-xs text-muted-foreground">{detail.label}</p>
                <p className="text-sm font-medium">{detail.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {vehicle.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descriere</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{vehicle.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      {vehicle.features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dotari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {vehicle.features.map((feature) => (
                <Badge key={feature} variant="secondary">
                  {feature}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

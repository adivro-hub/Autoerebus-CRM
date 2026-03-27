import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const brand = request.nextUrl.searchParams.get("brand");

  try {
    const where: Record<string, unknown> = {};
    if (brand && brand !== "ALL") where.brand = brand;

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        make: { select: { name: true } },
        model: { select: { name: true } },
        agent: { select: { firstName: true, lastName: true } },
        images: { orderBy: { order: "asc" }, select: { url: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // CSV header
    const headers = [
      "ID",
      "Titlu",
      "Marca",
      "Model",
      "An",
      "VIN",
      "Brand",
      "Stare",
      "Disponibilitate",
      "Combustibil",
      "Transmisie",
      "Tip Caroserie",
      "Tractiune",
      "Kilometraj",
      "Putere CP",
      "Cilindree cm3",
      "Emisii CO2",
      "Capacitate Baterie kWh",
      "Autonomie WLTP km",
      "Culoare",
      "Interior",
      "Usi",
      "Locuri",
      "Pret",
      "Pret Promotional",
      "Moneda",
      "TVA Deductibil",
      "Finantare Disponibila",
      "Test Drive Disponibil",
      "Badge Special",
      "Text Badge",
      "Featured",
      "Agent",
      "Proprietari Anteriori",
      "Data Inmatriculare",
      "Descriere",
      "Imagini",
      "Creat La",
      "Actualizat La",
    ];

    const escCsv = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = vehicles.map((v) => [
      v.id,
      v.title,
      v.make.name,
      v.model.name,
      v.year,
      v.vin,
      v.brand,
      v.condition,
      v.status,
      v.fuelType,
      v.transmission,
      v.bodyType,
      v.drivetrain,
      v.mileage,
      v.horsepower,
      v.engineSize,
      v.emissions,
      v.batteryCapacity,
      v.wltpRange,
      v.color,
      v.interiorColor,
      v.doors,
      v.seats,
      v.price,
      v.discountPrice,
      v.currency,
      v.vatDeductible ? "Da" : "Nu",
      v.availableFinancing ? "Da" : "Nu",
      v.availableTestDrive ? "Da" : "Nu",
      v.specialBadge ? "Da" : "Nu",
      v.specialBadgeText,
      v.featured ? "Da" : "Nu",
      v.agent ? `${v.agent.firstName} ${v.agent.lastName}` : "",
      v.previousOwners,
      v.registrationDate
        ? new Date(v.registrationDate).toISOString().split("T")[0]
        : "",
      v.description,
      v.images.map((i) => i.url).join(" | "),
      new Date(v.createdAt).toISOString(),
      new Date(v.updatedAt).toISOString(),
    ]);

    const csv =
      headers.map(escCsv).join(",") +
      "\n" +
      rows.map((row) => row.map(escCsv).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vehicule-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

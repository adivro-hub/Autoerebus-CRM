import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { pushVehicleToAutorulate } from "@/lib/autorulate-sync-push";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const imageList: { url: string; cloudinaryId: string; order: number }[] =
      body.images ?? [];

    // Create vehicle with nested images
    const vehicle = await prisma.vehicle.create({
      data: {
        title: body.title || null,
        makeId: body.makeId,
        modelId: body.modelId,
        year: body.year,
        mileage: body.mileage ?? 0,
        fuelType: body.fuelType,
        transmission: body.transmission,
        bodyType: body.bodyType || null,
        drivetrain: body.drivetrain || null,
        engineSize: body.engineSize || null,
        horsepower: body.horsepower || null,
        emissions: body.emissions || null,
        batteryCapacity: body.batteryCapacity || null,
        wltpRange: body.wltpRange || null,
        color: body.color || null,
        interiorColor: body.interiorColor || null,
        doors: body.doors || null,
        seats: body.seats || null,
        price: body.price,
        discountPrice: body.discountPrice || null,
        currency: body.currency || "EUR",
        vatDeductible: body.vatDeductible ?? false,
        availableFinancing: body.availableFinancing ?? false,
        condition: body.condition || "USED",
        status: body.status || "IN_STOCK",
        brand: body.brand,
        description: body.description || null,
        vin: body.vin || null,
        features: body.features || [],
        availableTestDrive: body.availableTestDrive ?? false,
        specialBadge: body.specialBadge ?? false,
        specialBadgeText: body.specialBadgeText || null,
        agentId: body.agentId || null,
        images: imageList.length > 0
          ? {
              create: imageList.map((img) => ({
                url: img.url,
                cloudinaryId: img.cloudinaryId,
                order: img.order,
              })),
            }
          : undefined,
      },
      include: {
        make: { select: { name: true, slug: true } },
        model: { select: { name: true, slug: true } },
        images: { orderBy: { order: "asc" } },
      },
    });

    // Push to Autorulate if brand is AUTORULATE
    if (vehicle.brand === "AUTORULATE") {
      try {
        const autorutaleId = await pushVehicleToAutorulate(vehicle as any);
        if (autorutaleId && !vehicle.autovitId) {
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { autovitId: `autorulate:${autorutaleId}` },
          });
        }
      } catch (err) {
        console.error("Autorulate push error (create):", err);
        // Don't fail the CRM save if push fails
      }
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating vehicle:", message);
    return NextResponse.json(
      { error: `Eroare la salvarea vehiculului: ${message}` },
      { status: 500 }
    );
  }
}

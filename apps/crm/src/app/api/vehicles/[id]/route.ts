import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { pushVehicleToAutorulate } from "@/lib/autorulate-sync-push";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        make: { select: { name: true } },
        model: { select: { name: true } },
        agent: { select: { firstName: true, lastName: true } },
        images: { orderBy: { order: "asc" } },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicul negasit" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const imageList: { url: string; cloudinaryId: string; order: number }[] =
    body.images ?? [];

  try {
    // Update vehicle fields
    await prisma.vehicle.update({
      where: { id },
      data: {
        title: body.title || null,
        make: { connect: { id: body.makeId } },
        model: { connect: { id: body.modelId } },
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
        priceNegotiable: body.priceNegotiable ?? false,
        noAccidents: body.noAccidents ?? false,
        serviceRecord: body.serviceRecord ?? false,
        previousOwners: body.previousOwners ?? null,
        registrationDate: body.registrationDate ? new Date(body.registrationDate) : null,
        generation: body.generation || null,
        emissionStandard: body.emissionStandard || null,
        fuelConsumptionUrban: body.fuelConsumptionUrban ?? null,
        fuelConsumptionExtraUrban: body.fuelConsumptionExtraUrban ?? null,
        fuelConsumptionCombined: body.fuelConsumptionCombined ?? null,
        condition: body.condition,
        status: body.status,
        brand: body.brand,
        description: body.description || null,
        vin: body.vin || null,
        availableTestDrive: body.availableTestDrive ?? false,
        specialBadge: body.specialBadge ?? false,
        specialBadgeText: body.specialBadgeText || null,
        agent: body.agentId
          ? { connect: { id: body.agentId } }
          : { disconnect: true },
      },
    });

    // Replace images: delete existing, create new
    await prisma.vehicleImage.deleteMany({ where: { vehicleId: id } });

    if (imageList.length > 0) {
      await prisma.vehicleImage.createMany({
        data: imageList.map((img) => ({
          vehicleId: id,
          url: img.url,
          cloudinaryId: img.cloudinaryId,
          order: img.order,
        })),
      });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        make: { select: { name: true, slug: true } },
        model: { select: { name: true, slug: true } },
        images: { orderBy: { order: "asc" } },
      },
    });

    // Push to Autorulate if brand is AUTORULATE
    if (vehicle?.brand === "AUTORULATE") {
      try {
        await pushVehicleToAutorulate(vehicle as any);
      } catch (err) {
        console.error("Autorulate push error (update):", err);
      }
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating vehicle:", message);
    return NextResponse.json(
      { error: `Eroare la salvarea vehiculului: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.vehicle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return NextResponse.json(
      { error: "Eroare la stergerea vehiculului" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import {
  getAutorutaleCars,
  getAutorutaleMakes,
  getAutorutaleModels,
  getAutorutaleImages,
  type AutorutaleCar,
} from "@/lib/autorulate-db";

// ─── Field Mappings ─────────────────────────────────────

function mapFuelType(fuel: string): string {
  const map: Record<string, string> = {
    PETROL: "BENZINA",
    DIESEL: "DIESEL",
    HYBRID: "HYBRID",
    "PLUG-IN HYBRID": "PHEV",
    "PLUG_IN_HYBRID": "PHEV",
    ELECTRIC: "ELECTRIC",
    LPG: "GPL",
    BENZINA: "BENZINA",
    PHEV: "PHEV",
    GPL: "GPL",
  };
  return map[fuel?.toUpperCase()] ?? "BENZINA";
}

function mapTransmission(trans: string): string {
  const map: Record<string, string> = {
    MANUAL: "MANUALA",
    AUTOMATIC: "AUTOMATA",
    MANUALA: "MANUALA",
    AUTOMATA: "AUTOMATA",
  };
  return map[trans?.toUpperCase()] ?? "MANUALA";
}

function mapBodyType(body: string | null): string | null {
  if (!body) return null;
  const map: Record<string, string> = {
    SEDAN: "sedan",
    SUV: "suv",
    HATCHBACK: "hatchback",
    WAGON: "break",
    COUPE: "coupe",
    CONVERTIBLE: "cabrio",
    MINIVAN: "monovolum",
    PICKUP: "pickup",
    VAN: "van",
  };
  return map[body.toUpperCase()] ?? body.toLowerCase();
}

function mapDrivetrain(drive: string | null): string | null {
  if (!drive) return null;
  const map: Record<string, string> = {
    FWD: "fwd",
    RWD: "rwd",
    AWD: "awd",
    "4WD": "4wd",
  };
  return map[drive.toUpperCase()] ?? drive.toLowerCase();
}

function mapStatus(status: string, stockStatus: string, price: number): string {
  if (status === "SOLD") return "SOLD";
  if (status === "RESERVED") return "RESERVED";
  if (price === 0) return "IN_TRANSIT";
  if (stockStatus === "COMING_SOON") return "IN_TRANSIT";
  return "IN_STOCK";
}

// engineSize is already in cm³ in both systems, no conversion needed

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Ensure a CarPropertyOption exists, create if missing
async function ensurePropertyOption(
  category: string,
  rawValue: string | null
): Promise<string | null> {
  if (!rawValue) return null;

  // Apply category-specific mapping
  let value: string;
  if (category === "bodyType") {
    value = mapBodyType(rawValue) ?? rawValue.toLowerCase();
  } else if (category === "drivetrain") {
    value = mapDrivetrain(rawValue) ?? rawValue.toLowerCase();
  } else {
    value = toSlug(rawValue);
  }

  const existing = await prisma.carPropertyOption.findUnique({
    where: { category_value: { category, value } },
  });

  if (!existing) {
    await prisma.carPropertyOption.create({
      data: {
        category,
        value,
        label: rawValue,
        order: 99,
      },
    });
  }

  return value;
}

// ─── GET: Preview what would be synced ──────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const [autorutaleCars, autorutaleMakes, autorutaleModels] =
      await Promise.all([
        getAutorutaleCars(),
        getAutorutaleMakes(),
        getAutorutaleModels(),
      ]);

    // Get existing synced cars (by VIN match or autovitId storing autorulate ID)
    const existingVehicles = await prisma.vehicle.findMany({
      where: { brand: "AUTORULATE" },
      select: { id: true, vin: true, autovitId: true, updatedAt: true },
    });

    const existingByVin = new Map(
      existingVehicles.filter((v) => v.vin).map((v) => [v.vin!, v])
    );
    const existingByAutorutaleId = new Map(
      existingVehicles
        .filter((v) => v.autovitId?.startsWith("autorulate:"))
        .map((v) => [v.autovitId!.replace("autorulate:", ""), v])
    );

    const newCars: AutorutaleCar[] = [];
    const updatedCars: (AutorutaleCar & { crmVehicleId: string })[] = [];
    const unchangedCount = { count: 0 };

    for (const car of autorutaleCars) {
      const existingByVinMatch = car.vin ? existingByVin.get(car.vin) : null;
      const existingByIdMatch = existingByAutorutaleId.get(String(car.id));
      const existing = existingByVinMatch || existingByIdMatch;

      if (existing) {
        const autorutaleUpdated = new Date(car.updatedAt);
        if (autorutaleUpdated > existing.updatedAt) {
          updatedCars.push({ ...car, crmVehicleId: existing.id });
        } else {
          unchangedCount.count++;
        }
      } else {
        newCars.push(car);
      }
    }

    // Build make/model lookup names
    const makeMap = new Map(autorutaleMakes.map((m) => [m.id, m.name]));
    const modelMap = new Map(autorutaleModels.map((m) => [m.id, m.name]));

    return NextResponse.json({
      success: true,
      data: {
        totalInAutorulate: autorutaleCars.length,
        totalInCRM: existingVehicles.length,
        newCars: newCars.map((c) => ({
          id: c.id,
          title: c.title,
          make: makeMap.get(c.makeId) ?? "Unknown",
          model: modelMap.get(c.modelId) ?? "Unknown",
          year: c.year,
          price: c.price,
          vin: c.vin,
          status: c.status,
          updatedAt: c.updatedAt,
        })),
        updatedCars: updatedCars.map((c) => ({
          id: c.id,
          crmVehicleId: c.crmVehicleId,
          title: c.title,
          make: makeMap.get(c.makeId) ?? "Unknown",
          model: modelMap.get(c.modelId) ?? "Unknown",
          year: c.year,
          price: c.price,
          vin: c.vin,
          status: c.status,
          updatedAt: c.updatedAt,
        })),
        unchanged: unchangedCount.count,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sync preview error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST: Execute sync ─────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { importNew = true, updateExisting = true } = body;

    const [autorutaleCars, autorutaleMakes, autorutaleModels] =
      await Promise.all([
        getAutorutaleCars(),
        getAutorutaleMakes(),
        getAutorutaleModels(),
      ]);

    // Ensure all makes/models exist in CRM
    const makeMapping = new Map<number, string>(); // autorulate ID -> CRM ID
    const modelMapping = new Map<number, string>();

    for (const aMake of autorutaleMakes) {
      let crmMake = await prisma.make.findUnique({
        where: { slug: aMake.slug },
      });
      if (!crmMake) {
        crmMake = await prisma.make.create({
          data: { name: aMake.name, slug: aMake.slug, logo: aMake.logo },
        });
      }
      makeMapping.set(aMake.id, crmMake.id);
    }

    for (const aModel of autorutaleModels) {
      const crmMakeId = makeMapping.get(aModel.makeId);
      if (!crmMakeId) continue;

      let crmModel = await prisma.vehicleModel.findUnique({
        where: { makeId_slug: { makeId: crmMakeId, slug: aModel.slug } },
      });
      if (!crmModel) {
        crmModel = await prisma.vehicleModel.create({
          data: {
            name: aModel.name,
            slug: aModel.slug,
            makeId: crmMakeId,
          },
        });
      }
      modelMapping.set(aModel.id, crmModel.id);
    }

    // Get existing CRM vehicles
    const existingVehicles = await prisma.vehicle.findMany({
      where: { brand: "AUTORULATE" },
      select: { id: true, vin: true, autovitId: true, updatedAt: true },
    });

    const existingByVin = new Map(
      existingVehicles.filter((v) => v.vin).map((v) => [v.vin!, v])
    );
    const existingByAutorutaleId = new Map(
      existingVehicles
        .filter((v) => v.autovitId?.startsWith("autorulate:"))
        .map((v) => [v.autovitId!.replace("autorulate:", ""), v])
    );

    let imported = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const car of autorutaleCars) {
      const crmMakeId = makeMapping.get(car.makeId);
      const crmModelId = modelMapping.get(car.modelId);
      if (!crmMakeId || !crmModelId) {
        errors.push(`Skip ${car.title}: make/model not mapped`);
        continue;
      }

      const existingByVinMatch = car.vin
        ? existingByVin.get(car.vin)
        : null;
      const existingByIdMatch = existingByAutorutaleId.get(String(car.id));
      const existing = existingByVinMatch || existingByIdMatch;

      // Ensure property options exist, create if missing
      const [bodyTypeVal, drivetrainVal, colorVal, intColorVal] =
        await Promise.all([
          ensurePropertyOption("bodyType", car.bodyType),
          ensurePropertyOption("drivetrain", car.drivetrain),
          ensurePropertyOption("color", car.exteriorColor),
          ensurePropertyOption("interiorColor", car.interiorColor),
        ]);

      const vehicleData = {
        title: car.title || null,
        externalSlug: car.slug || null,
        makeId: crmMakeId,
        modelId: crmModelId,
        year: car.year,
        mileage: car.mileage,
        fuelType: mapFuelType(car.fuelType) as any,
        transmission: mapTransmission(car.transmission) as any,
        bodyType: bodyTypeVal,
        drivetrain: drivetrainVal,
        engineSize: car.engineSize,
        horsepower: car.horsepower,
        emissions: car.co2Emissions,
        batteryCapacity: car.batteryCapacity
          ? car.batteryCapacity / 1
          : null,
        wltpRange: car.wltpRange,
        color: colorVal,
        interiorColor: intColorVal,
        doors: car.doors,
        seats: car.seats,
        price: car.price,
        discountPrice: car.discountPrice,
        currency: "EUR",
        vatDeductible: car.vatDeductible,
        availableFinancing: car.financingAvailable,
        condition: "USED" as any,
        status: mapStatus(car.status, car.stockStatus, car.price) as any,
        brand: "AUTORULATE" as any,
        description: car.description,
        vin: car.vin,
        featured: car.featured,
        specialBadge: !!car.badgeText,
        specialBadgeText: car.badgeText,
        previousOwners: car.previousOwners,
        registrationDate: car.registrationDate
          ? new Date(car.registrationDate)
          : null,
        autovitId: `autorulate:${car.id}`,
        autovitSyncedAt: new Date(),
      };

      try {
        if (existing) {
          if (!updateExisting) continue;
          const autorutaleUpdated = new Date(car.updatedAt);
          if (autorutaleUpdated <= existing.updatedAt) continue;

          await prisma.vehicle.update({
            where: { id: existing.id },
            data: vehicleData,
          });

          // Sync images
          const autorutaleImages = await getAutorutaleImages(car.id);
          await prisma.vehicleImage.deleteMany({
            where: { vehicleId: existing.id },
          });
          if (autorutaleImages.length > 0) {
            await prisma.vehicleImage.createMany({
              data: autorutaleImages.map((img) => ({
                vehicleId: existing.id,
                url: img.url,
                cloudinaryId: img.publicId,
                alt: img.alt,
                order: img.sortOrder,
              })),
            });
          }

          updated++;
        } else {
          if (!importNew) continue;

          const created = await prisma.vehicle.create({
            data: vehicleData,
          });

          // Import images
          const autorutaleImages = await getAutorutaleImages(car.id);
          if (autorutaleImages.length > 0) {
            await prisma.vehicleImage.createMany({
              data: autorutaleImages.map((img) => ({
                vehicleId: created.id,
                url: img.url,
                cloudinaryId: img.publicId,
                alt: img.alt,
                order: img.sortOrder,
              })),
            });
          }

          imported++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${car.title}: ${msg.substring(0, 100)}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported, updated, errors: errors.slice(0, 20) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sync error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

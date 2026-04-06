import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import {
  isAutovitConfigured,
  getAutovitAdverts,
  createAutovitAdvert,
  updateAutovitAdvert,
  deleteAutovitAdvert,
  activateAutovitAdvert,
  deactivateAutovitAdvert,
  createImageCollection,
  mapCrmToAutovit,
  type CrmVehicleForAutovit,
} from "@/lib/autovit-api";

// Default config — can be made editable later
const AUTOVIT_CONFIG = {
  regionId: Number(process.env.AUTOVIT_REGION_ID || "7"), // Bucuresti
  cityId: Number(process.env.AUTOVIT_CITY_ID || "7930"), // Bucuresti
  districtId: process.env.AUTOVIT_DISTRICT_ID ? Number(process.env.AUTOVIT_DISTRICT_ID) : undefined,
  contactPerson: process.env.AUTOVIT_CONTACT_PERSON || "Autoerebus",
  contactPhones: process.env.AUTOVIT_CONTACT_PHONES?.split(",") || [],
  latitude: process.env.AUTOVIT_LATITUDE ? Number(process.env.AUTOVIT_LATITUDE) : undefined,
  longitude: process.env.AUTOVIT_LONGITUDE ? Number(process.env.AUTOVIT_LONGITUDE) : undefined,
};

// GET — List CRM vehicles with Autovit sync status
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Check config
  if (action === "status") {
    return NextResponse.json({
      configured: isAutovitConfigured(),
      config: {
        regionId: AUTOVIT_CONFIG.regionId,
        cityId: AUTOVIT_CONFIG.cityId,
        contactPerson: AUTOVIT_CONFIG.contactPerson,
      },
    });
  }

  // Get adverts from Autovit
  if (action === "remote") {
    if (!isAutovitConfigured()) {
      return NextResponse.json({ error: "Autovit API nu este configurat" }, { status: 400 });
    }
    try {
      const page = Number(searchParams.get("page") || "1");
      const data = await getAutovitAdverts(page, 50);
      return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // List CRM vehicles with autovit sync info
  const brand = searchParams.get("brand");
  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || "all"; // all, synced, not-synced

  const where: Record<string, unknown> = {};
  if (brand && brand !== "ALL") where.brand = brand;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { make: { name: { contains: search, mode: "insensitive" } } },
      { model: { name: { contains: search, mode: "insensitive" } } },
      { vin: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filter === "synced") where.autovitId = { not: null };
  if (filter === "not-synced") where.autovitId = null;

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: {
      id: true,
      title: true,
      year: true,
      price: true,
      discountPrice: true,
      mileage: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      condition: true,
      status: true,
      brand: true,
      vin: true,
      autovitId: true,
      autovitSyncedAt: true,
      engineSize: true,
      horsepower: true,
      batteryCapacity: true,
      wltpRange: true,
      color: true,
      doors: true,
      drivetrain: true,
      description: true,
      make: { select: { name: true, slug: true } },
      model: { select: { name: true, slug: true } },
      images: { select: { url: true, order: true }, orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ success: true, data: vehicles });
}

// POST — Publish/update vehicles to Autovit
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  if (!isAutovitConfigured()) {
    return NextResponse.json({ error: "Autovit API nu este configurat. Adaugă AUTOVIT_CLIENT_ID, AUTOVIT_CLIENT_SECRET, AUTOVIT_USERNAME, AUTOVIT_PASSWORD." }, { status: 400 });
  }

  const body = await request.json();
  const { action, vehicleIds } = body as { action: string; vehicleIds: string[] };

  if (!vehicleIds?.length) {
    return NextResponse.json({ error: "Selectează cel puțin un vehicul" }, { status: 400 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    include: {
      make: { select: { name: true, slug: true } },
      model: { select: { name: true, slug: true } },
      images: { select: { url: true, order: true }, orderBy: { order: "asc" } },
      equipment: { select: { item: { select: { autovitKey: true } } } },
    },
  });

  const results: { vehicleId: string; title: string; success: boolean; autovitId?: string; error?: string }[] = [];

  for (const vehicle of vehicles) {
    try {
      const crmVehicle: CrmVehicleForAutovit = {
        id: vehicle.id,
        title: vehicle.title,
        vin: vehicle.vin,
        year: vehicle.year,
        mileage: vehicle.mileage,
        engineSize: vehicle.engineSize,
        horsepower: vehicle.horsepower,
        batteryCapacity: vehicle.batteryCapacity,
        wltpRange: vehicle.wltpRange,
        price: vehicle.price,
        discountPrice: vehicle.discountPrice,
        condition: vehicle.condition,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        bodyType: vehicle.bodyType,
        drivetrain: vehicle.drivetrain,
        color: vehicle.color,
        doors: vehicle.doors,
        description: vehicle.description,
        make: vehicle.make,
        model: vehicle.model,
        images: vehicle.images,
        equipment: vehicle.equipment,
        autovitId: vehicle.autovitId,
      };

      if (action === "publish") {
        // Upload images first
        let imageCollectionId: string | undefined;
        if (vehicle.images.length > 0) {
          const imageUrls = vehicle.images.map((img: { url: string }) => img.url);
          const collection = await createImageCollection(imageUrls);
          imageCollectionId = String(collection.id);
        }

        const payload = mapCrmToAutovit(crmVehicle, AUTOVIT_CONFIG);
        if (imageCollectionId) payload.image_collection_id = imageCollectionId;

        if (vehicle.autovitId) {
          // Update existing
          const advert = await updateAutovitAdvert(Number(vehicle.autovitId), payload);
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { autovitSyncedAt: new Date() },
          });
          results.push({ vehicleId: vehicle.id, title: vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`, success: true, autovitId: String(advert.id) });
        } else {
          // Create new
          const advert = await createAutovitAdvert(payload);
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { autovitId: String(advert.id), autovitSyncedAt: new Date() },
          });
          results.push({ vehicleId: vehicle.id, title: vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`, success: true, autovitId: String(advert.id) });
        }
      } else if (action === "deactivate") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await deactivateAutovitAdvert(Number(vehicle.autovitId));
        results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: true });
      } else if (action === "activate") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await activateAutovitAdvert(Number(vehicle.autovitId));
        results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: true });
      } else if (action === "delete") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await deleteAutovitAdvert(Number(vehicle.autovitId));
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { autovitId: null, autovitSyncedAt: null },
        });
        results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: true });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      results.push({ vehicleId: vehicle.id, title: vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`, success: false, error: msg });
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: `AUTOVIT_${action.toUpperCase()}`,
      entity: "Vehicle",
      details: `Autovit ${action}: ${results.filter((r) => r.success).length}/${results.length} reușite`,
      userId: (session.user as { id?: string })?.id || null,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, results });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import {
  isAutovitConfigured,
  getAutovitAdverts,
  getAutovitAdvert,
  createAutovitAdvert,
  updateAutovitAdvert,
  deleteAutovitAdvert,
  activateAutovitAdvert,
  deactivateAutovitAdvert,
  createImageCollection,
  mapCrmToAutovit,
  applyPromotion,
  getAvailablePromotions,
  type CrmVehicleForAutovit,
} from "@/lib/autovit-api";

// Autovit promotion IDs
const PROMO_EXPORT_OLX = 49; // free export to OLX.ro

interface DealerConfig {
  regionId?: number;
  cityId: number;
  districtId?: number;
  contactPerson?: string;
  contactPhones?: string[];
  latitude?: number;
  longitude?: number;
}

async function loadDealerConfig(): Promise<DealerConfig | null> {
  const rec = await prisma.siteSettings.findUnique({
    where: { key: "autovit_dealer_config" },
  });
  if (!rec) return null;
  const v = rec.value as any;
  if (!v.cityId) return null; // city is required
  return {
    regionId: v.regionId || undefined,
    cityId: Number(v.cityId),
    districtId: v.districtId ? Number(v.districtId) : undefined,
    contactPerson: v.contactPerson || undefined,
    contactPhones: Array.isArray(v.contactPhones) && v.contactPhones.length ? v.contactPhones : undefined,
    latitude: v.latitude ? Number(v.latitude) : undefined,
    longitude: v.longitude ? Number(v.longitude) : undefined,
  };
}

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
    const dealerConfig = await loadDealerConfig();
    return NextResponse.json({
      configured: isAutovitConfigured(),
      dealerConfigured: !!dealerConfig,
      config: dealerConfig,
    });
  }

  // Refresh autovitStatus for all vehicles with autovitId
  if (action === "refresh-statuses") {
    if (!isAutovitConfigured()) {
      return NextResponse.json({ error: "Autovit API nu este configurat" }, { status: 400 });
    }
    const published = await prisma.vehicle.findMany({
      where: { autovitId: { not: null } },
      select: { id: true, autovitId: true },
    });
    let updated = 0;
    const errors: { vehicleId: string; error: string }[] = [];
    for (const v of published) {
      if (!v.autovitId || !/^\d+$/.test(v.autovitId)) continue;
      try {
        const advert = await getAutovitAdvert(Number(v.autovitId));
        await prisma.vehicle.update({
          where: { id: v.id },
          data: { autovitStatus: advert.status || null },
        });
        updated++;
      } catch (e) {
        errors.push({ vehicleId: v.id, error: e instanceof Error ? e.message : "Eroare" });
      }
    }
    return NextResponse.json({ success: true, updated, total: published.length, errors });
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
      autovitStatus: true,
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

  const dealerConfig = await loadDealerConfig();
  if (!dealerConfig) {
    return NextResponse.json(
      { error: "Setările dealer Autovit nu sunt configurate. Mergi la Setări → Autovit și alege orașul." },
      { status: 400 }
    );
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

  const results: {
    vehicleId: string;
    title: string;
    success: boolean;
    autovitId?: string;
    error?: string;
    steps?: { name: string; ok: boolean; info?: string }[];
  }[] = [];

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
        seats: (vehicle as any).seats ?? null,
        emissions: (vehicle as any).emissions ?? null,
        registrationDate: (vehicle as any).registrationDate ?? null,
        previousOwners: (vehicle as any).previousOwners ?? null,
        vatDeductible: (vehicle as any).vatDeductible ?? false,
        availableFinancing: (vehicle as any).availableFinancing ?? false,
        priceNegotiable: (vehicle as any).priceNegotiable ?? false,
        noAccidents: (vehicle as any).noAccidents ?? false,
        serviceRecord: (vehicle as any).serviceRecord ?? false,
        generation: (vehicle as any).generation ?? null,
        emissionStandard: (vehicle as any).emissionStandard ?? null,
        fuelConsumptionUrban: (vehicle as any).fuelConsumptionUrban ?? null,
        fuelConsumptionExtraUrban: (vehicle as any).fuelConsumptionExtraUrban ?? null,
        fuelConsumptionCombined: (vehicle as any).fuelConsumptionCombined ?? null,
        description: vehicle.description,
        make: vehicle.make,
        model: vehicle.model,
        images: vehicle.images,
        equipment: vehicle.equipment,
        autovitId: vehicle.autovitId,
      };

      if (action === "publish") {
        const steps: { name: string; ok: boolean; info?: string }[] = [];
        const title = vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`;

        // Step 1: upload images
        let imageCollectionId: string | undefined;
        if (vehicle.images.length > 0) {
          try {
            const collection = await createImageCollection(vehicle.images.map((i: { url: string }) => i.url));
            imageCollectionId = String(collection.id);
            steps.push({ name: "Imagini", ok: true, info: `${vehicle.images.length} imagini` });
          } catch (e) {
            steps.push({ name: "Imagini", ok: false, info: e instanceof Error ? e.message : "Eroare" });
          }
        }

        // Step 2: map + create/update advert
        const payload = await mapCrmToAutovit(crmVehicle, dealerConfig);
        if (imageCollectionId) payload.image_collection_id = imageCollectionId;

        const numericAutovitId =
          vehicle.autovitId && /^\d+$/.test(vehicle.autovitId) ? Number(vehicle.autovitId) : null;

        let advertId: number;
        const isUpdate = !!numericAutovitId;
        try {
          if (numericAutovitId) {
            const advert = await updateAutovitAdvert(numericAutovitId, payload);
            advertId = Number(advert.id);
            await prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { autovitSyncedAt: new Date() },
            });
            steps.push({ name: "Actualizare anunț", ok: true, info: `ID ${advertId}` });
          } else {
            const advert = await createAutovitAdvert(payload);
            advertId = Number(advert.id);
            await prisma.vehicle.update({
              where: { id: vehicle.id },
              data: {
                autovitId: String(advertId),
                autovitStatus: "unpaid",
                autovitSyncedAt: new Date(),
              },
            });
            steps.push({ name: "Creare anunț", ok: true, info: `ID ${advertId}` });
          }
        } catch (e) {
          steps.push({ name: isUpdate ? "Actualizare anunț" : "Creare anunț", ok: false, info: e instanceof Error ? e.message : "Eroare" });
          results.push({
            vehicleId: vehicle.id,
            title,
            success: false,
            error: e instanceof Error ? e.message : "Eroare",
            steps,
          });
          continue;
        }

        results.push({
          vehicleId: vehicle.id,
          title,
          success: true,
          autovitId: String(advertId),
          steps,
        });
      } else if (action === "export-olx") {
        const title = vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`;
        if (!vehicle.autovitId || !/^\d+$/.test(vehicle.autovitId)) {
          results.push({ vehicleId: vehicle.id, title, success: false, error: "Anunțul nu e publicat pe Autovit. Publică întâi." });
          continue;
        }
        const advertId = Number(vehicle.autovitId);
        try {
          const available = await getAvailablePromotions(advertId);
          if (!available.export_olx) {
            results.push({
              vehicleId: vehicle.id,
              title,
              success: false,
              error: "Export OLX nu e disponibil. Poate anunțul e deja activat — exportul gratuit funcționează doar pe anunțuri neactivate.",
            });
            continue;
          }
          await applyPromotion(advertId, [PROMO_EXPORT_OLX]);
          results.push({
            vehicleId: vehicle.id,
            title,
            success: true,
            autovitId: String(advertId),
            steps: [{ name: "Export OLX", ok: true, info: "Gratuit, în coadă (se aplică la activare)" }],
          });
        } catch (e) {
          results.push({
            vehicleId: vehicle.id,
            title,
            success: false,
            error: e instanceof Error ? e.message : "Eroare",
          });
        }
      } else if (action === "deactivate") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await deactivateAutovitAdvert(Number(vehicle.autovitId));
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { autovitStatus: "deactivated", autovitSyncedAt: new Date() },
        });
        results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: true });
      } else if (action === "activate") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await activateAutovitAdvert(Number(vehicle.autovitId));
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { autovitStatus: "active", autovitSyncedAt: new Date() },
        });
        results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: true });
      } else if (action === "delete") {
        if (!vehicle.autovitId) {
          results.push({ vehicleId: vehicle.id, title: vehicle.title || "", success: false, error: "Nu este publicat pe Autovit" });
          continue;
        }
        await deleteAutovitAdvert(Number(vehicle.autovitId));
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { autovitId: null, autovitStatus: null, autovitSyncedAt: null },
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

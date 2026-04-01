import { autorutalePool } from "./autorulate-db";

// ─── Reverse mappings (CRM -> Autorulate) ───────────────

function mapFuelTypeReverse(fuel: string): string {
  const map: Record<string, string> = {
    BENZINA: "PETROL",
    DIESEL: "DIESEL",
    HYBRID: "HYBRID",
    PHEV: "PLUG_IN_HYBRID",
    ELECTRIC: "ELECTRIC",
    GPL: "LPG",
  };
  return map[fuel] ?? fuel;
}

function mapTransmissionReverse(trans: string): string {
  const map: Record<string, string> = {
    MANUALA: "MANUAL",
    AUTOMATA: "AUTOMATIC",
  };
  return map[trans] ?? trans;
}

function mapBodyTypeReverse(body: string | null): string {
  if (!body) return "SEDAN";
  const map: Record<string, string> = {
    sedan: "SEDAN",
    suv: "SUV",
    hatchback: "HATCHBACK",
    break: "WAGON",
    coupe: "COUPE",
    cabrio: "CONVERTIBLE",
    monovolum: "MINIVAN",
    pickup: "PICKUP",
    van: "VAN",
  };
  return map[body.toLowerCase()] ?? body.toUpperCase();
}

function mapDrivetrainReverse(drive: string | null): string | null {
  if (!drive) return null;
  return drive.toUpperCase(); // fwd -> FWD
}

function mapStatusReverse(status: string): string {
  const map: Record<string, string> = {
    IN_STOCK: "AVAILABLE",
    IN_TRANSIT: "AVAILABLE",
    RESERVED: "RESERVED",
    SOLD: "SOLD",
  };
  return map[status] ?? "AVAILABLE";
}

function mapStockStatusReverse(status: string): string {
  return status === "IN_TRANSIT" ? "COMING_SOON" : "IN_STOCK";
}

// engineSize is in cm³ in both systems, no conversion needed

// ─── Push vehicle to Autorulate DB ──────────────────────

interface CrmVehicle {
  id: string;
  title: string | null;
  vin: string | null;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  drivetrain: string | null;
  engineSize: number | null;
  horsepower: number | null;
  emissions: number | null;
  batteryCapacity: number | null;
  wltpRange: number | null;
  color: string | null;
  interiorColor: string | null;
  doors: number | null;
  seats: number | null;
  price: number;
  discountPrice: number | null;
  vatDeductible: boolean;
  availableFinancing: boolean;
  condition: string;
  status: string;
  brand: string;
  description: string | null;
  featured: boolean;
  specialBadge: boolean;
  specialBadgeText: string | null;
  availableTestDrive: boolean;
  previousOwners: number | null;
  registrationDate: Date | null;
  autovitId: string | null;
  make: { name: string; slug: string };
  model: { name: string; slug: string };
  images: { url: string; cloudinaryId: string | null; alt: string | null; order: number }[];
}

export async function pushVehicleToAutorulate(vehicle: CrmVehicle) {
  if (vehicle.brand !== "AUTORULATE") return;

  const autorutaleId = vehicle.autovitId?.startsWith("autorulate:")
    ? parseInt(vehicle.autovitId.replace("autorulate:", ""), 10)
    : null;

  // Resolve make ID in Autorulate
  const makeResult = await autorutalePool.query(
    "SELECT id FROM makes WHERE slug = $1",
    [vehicle.make.slug]
  );
  if (makeResult.rows.length === 0) return; // make doesn't exist in autorulate
  const autorutaleMakeId = makeResult.rows[0].id;

  // Resolve model ID in Autorulate
  const modelResult = await autorutalePool.query(
    'SELECT id FROM models WHERE slug = $1 AND "makeId" = $2',
    [vehicle.model.slug, autorutaleMakeId]
  );
  if (modelResult.rows.length === 0) return; // model doesn't exist in autorulate
  const autorutaleModelId = modelResult.rows[0].id;

  const slug =
    `${vehicle.make.slug}-${vehicle.model.slug}-${vehicle.year}`.toLowerCase();
  const title = vehicle.title || `${vehicle.make.name} ${vehicle.model.name}`;

  const carData = {
    slug,
    title,
    status: mapStatusReverse(vehicle.status),
    makeId: autorutaleMakeId,
    modelId: autorutaleModelId,
    year: vehicle.year,
    price: vehicle.price,
    discountPrice: vehicle.discountPrice,
    vatDeductible: vehicle.vatDeductible,
    mileage: vehicle.mileage,
    bodyType: mapBodyTypeReverse(vehicle.bodyType),
    fuelType: mapFuelTypeReverse(vehicle.fuelType),
    transmission: mapTransmissionReverse(vehicle.transmission),
    drivetrain: mapDrivetrainReverse(vehicle.drivetrain),
    engineSize: vehicle.engineSize,
    horsepower: vehicle.horsepower,
    co2Emissions: vehicle.emissions,
    batteryCapacity: vehicle.batteryCapacity,
    wltpRange: vehicle.wltpRange,
    exteriorColor: vehicle.color,
    interiorColor: vehicle.interiorColor,
    seats: vehicle.seats,
    doors: vehicle.doors,
    vin: vehicle.vin,
    registrationDate: vehicle.registrationDate,
    previousOwners: vehicle.previousOwners,
    description: vehicle.description,
    featured: vehicle.featured,
    badgeText: vehicle.specialBadge ? vehicle.specialBadgeText : null,
    financingAvailable: vehicle.availableFinancing,
    availableTestDrive: vehicle.availableTestDrive,
    stockStatus: mapStockStatusReverse(vehicle.status),
  };

  if (autorutaleId) {
    // UPDATE existing car
    const setClauses = Object.entries(carData)
      .map(([key, _], i) => `"${key}" = $${i + 1}`)
      .join(", ");
    const values = Object.values(carData);

    await autorutalePool.query(
      `UPDATE cars SET ${setClauses}, "updatedAt" = NOW() WHERE id = $${values.length + 1}`,
      [...values, autorutaleId]
    );

    // Sync images: delete old, insert new
    await autorutalePool.query(
      'DELETE FROM car_images WHERE "carId" = $1',
      [autorutaleId]
    );

    for (const img of vehicle.images) {
      await autorutalePool.query(
        'INSERT INTO car_images ("carId", url, "publicId", alt, "isPrimary", "sortOrder") VALUES ($1, $2, $3, $4, $5, $6)',
        [
          autorutaleId,
          img.url,
          img.cloudinaryId,
          img.alt,
          img.order === 0,
          img.order,
        ]
      );
    }
  } else {
    // INSERT new car — need unique slug
    const existingSlug = await autorutalePool.query(
      "SELECT id FROM cars WHERE slug = $1",
      [slug]
    );
    const finalSlug = existingSlug.rows.length > 0
      ? `${slug}-${Date.now()}`
      : slug;

    const columns = ['"slug"', ...Object.keys(carData).filter(k => k !== 'slug').map(k => `"${k}"`)];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const values = [finalSlug, ...Object.entries(carData).filter(([k]) => k !== 'slug').map(([, v]) => v)];

    const insertResult = await autorutalePool.query(
      `INSERT INTO cars (${columns.join(", ")}, "createdAt", "updatedAt") VALUES (${placeholders}, NOW(), NOW()) RETURNING id`,
      values
    );

    const newAutorutaleId = insertResult.rows[0].id;

    // Insert images
    for (const img of vehicle.images) {
      await autorutalePool.query(
        'INSERT INTO car_images ("carId", url, "publicId", alt, "isPrimary", "sortOrder") VALUES ($1, $2, $3, $4, $5, $6)',
        [
          newAutorutaleId,
          img.url,
          img.cloudinaryId,
          img.alt,
          img.order === 0,
          img.order,
        ]
      );
    }

    return newAutorutaleId; // so we can store autorulate:ID back in CRM
  }
}

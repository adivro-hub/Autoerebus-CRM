import { Pool, neonConfig } from "@neondatabase/serverless";

if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // Edge runtime
  }
}

const globalForPool = globalThis as unknown as {
  autorutalePool: Pool | undefined;
};

function createPool() {
  const connectionString = process.env.AUTORULATE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("AUTORULATE_DATABASE_URL environment variable is not set");
  }
  return new Pool({ connectionString });
}

export const autorutalePool =
  globalForPool.autorutalePool ?? createPool();

if (process.env.NODE_ENV !== "production")
  globalForPool.autorutalePool = autorutalePool;

// ─── Types matching Autorulate DB schema ────────────────

export interface AutorutaleCar {
  id: number;
  slug: string;
  title: string;
  status: string; // AVAILABLE, RESERVED, SOLD
  makeId: number;
  modelId: number;
  year: number;
  price: number;
  discountPrice: number | null;
  mileage: number;
  bodyType: string;
  fuelType: string;
  transmission: string;
  drivetrain: string | null;
  engineSize: number | null; // in cc (e.g. 1968)
  horsepower: number | null;
  co2Emissions: number | null;
  batteryCapacity: number | null;
  wltpRange: number | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  interiorMaterial: string | null;
  seats: number | null;
  doors: number | null;
  vin: string | null;
  registrationDate: string | null;
  previousOwners: number | null;
  description: string | null;
  featured: boolean;
  vatDeductible: boolean;
  financingAvailable: boolean;
  badgeText: string | null;
  stockStatus: string; // IN_STOCK, COMING_SOON
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutorutaleMake {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
}

export interface AutorutaleModel {
  id: number;
  name: string;
  slug: string;
  makeId: number;
}

export interface AutorutaleImage {
  id: number;
  carId: number;
  url: string;
  publicId: string | null;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

// ─── Query helpers ──────────────────────────────────────

export async function getAutorutaleCars(): Promise<AutorutaleCar[]> {
  const result = await autorutalePool.query(
    'SELECT * FROM cars ORDER BY "updatedAt" DESC'
  );
  return result.rows;
}

export async function getAutorutaleMakes(): Promise<AutorutaleMake[]> {
  const result = await autorutalePool.query(
    "SELECT * FROM makes ORDER BY name"
  );
  return result.rows;
}

export async function getAutorutaleModels(): Promise<AutorutaleModel[]> {
  const result = await autorutalePool.query(
    "SELECT * FROM models ORDER BY name"
  );
  return result.rows;
}

export async function getAutorutaleImages(
  carId: number
): Promise<AutorutaleImage[]> {
  const result = await autorutalePool.query(
    'SELECT * FROM car_images WHERE "carId" = $1 ORDER BY "sortOrder" ASC',
    [carId]
  );
  return result.rows;
}

export async function getAutorutaleCarsSince(
  since: Date
): Promise<AutorutaleCar[]> {
  const result = await autorutalePool.query(
    'SELECT * FROM cars WHERE "updatedAt" > $1 ORDER BY "updatedAt" DESC',
    [since]
  );
  return result.rows;
}

// Autovit API v2.0.0 Client
// Base URL: https://www.autovit.ro/api/open
// Auth: OAuth2 (password grant)

const BASE_URL = "https://www.autovit.ro/api/open";

interface AutovitTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

interface AutovitAdvert {
  id: number;
  user_id: number;
  status: string;
  title: string;
  url: string;
  created_at: string;
  valid_to: string;
  description: string;
  category_id: number;
  region_id: number;
  city_id: number;
  params: Record<string, unknown>;
  external_id?: string;
  new_used: string;
  advertiser_type: string;
  image_collection_id?: string;
}

interface AutovitCreateAdvertPayload {
  title: string;
  description: string;
  category_id: number;
  region_id: number;
  city_id: number;
  district_id?: number;
  new_used: string;
  advertiser_type: string;
  image_collection_id?: string;
  contact?: {
    person?: string;
    phones?: string[];
  };
  coordinates?: {
    latitude: number;
    longitude: number;
    radius?: number;
    zoom_level?: number;
  };
  params: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    fuel_type?: string;
    engine_power?: string;
    engine_capacity?: string;
    door_count?: number;
    gearbox?: string;
    mileage?: number;
    body_type?: string;
    color?: string;
    price?: {
      0: "price";
      1: number;
      currency: string;
      gross_net: string;
    };
    generation?: string;
    version?: string;
    video?: string;
    [key: string]: unknown;
  };
}

// ─── Token Management ──────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.AUTOVIT_CLIENT_ID;
  const clientSecret = process.env.AUTOVIT_CLIENT_SECRET;
  const username = process.env.AUTOVIT_USERNAME;
  const password = process.env.AUTOVIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Autovit API credentials not configured. Set AUTOVIT_CLIENT_ID, AUTOVIT_CLIENT_SECRET, AUTOVIT_USERNAME, AUTOVIT_PASSWORD.");
  }

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "password",
      username,
      password,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Autovit auth failed (${res.status}): ${err}`);
  }

  const data: AutovitTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function autovitFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const userAgent = process.env.AUTOVIT_USERNAME || "api@autoerebus.ro";

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
      ...options.headers,
    },
  });
}

// ─── Account Adverts ────────────────────────────────────

export async function getAutovitAdverts(page = 1, limit = 50): Promise<{ results: AutovitAdvert[]; total: number }> {
  const res = await autovitFetch(`/account/adverts?page=${page}&limit=${limit}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch adverts (${res.status}): ${err}`);
  }
  return res.json();
}

export async function getAutovitAdvert(id: number): Promise<AutovitAdvert> {
  const res = await autovitFetch(`/account/adverts/${id}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch advert ${id} (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Create / Update / Delete ───────────────────────────

export async function createAutovitAdvert(payload: AutovitCreateAdvertPayload): Promise<AutovitAdvert> {
  const res = await autovitFetch("/account/adverts?v=2", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Failed to create advert (${res.status}): ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function updateAutovitAdvert(id: number, payload: Partial<AutovitCreateAdvertPayload>): Promise<AutovitAdvert> {
  const res = await autovitFetch(`/account/adverts/${id}?v=2`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Failed to update advert ${id} (${res.status}): ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function deleteAutovitAdvert(id: number): Promise<void> {
  const res = await autovitFetch(`/adverts/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete advert ${id} (${res.status}): ${err}`);
  }
}

export async function activateAutovitAdvert(id: number): Promise<void> {
  const res = await autovitFetch(`/account/adverts/${id}/activate`, { method: "POST" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to activate advert ${id} (${res.status}): ${err}`);
  }
}

/**
 * Apply a promotion (e.g. free OLX export = promotion_id 49) to an advert.
 * Must be called BEFORE activation based on empirical testing.
 */
export async function applyPromotion(
  advertId: number,
  promotionIds: number[],
  paymentType: "account" | "postpay" = "account"
): Promise<void> {
  const res = await autovitFetch(`/account/adverts/${advertId}/promotions/`, {
    method: "POST",
    body: JSON.stringify({
      payment_type: paymentType,
      promotion_ids: promotionIds,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to apply promotion ${promotionIds.join(",")} on ${advertId} (${res.status}): ${err}`);
  }
}

/**
 * Check which promotions are available for an advert (including free export_olx).
 * Returns a map of promotion code -> promotion details.
 */
export async function getAvailablePromotions(
  advertId: number
): Promise<Record<string, { promotion_id: string; promotion_code: string; promotion_name: string; price: number }>> {
  const res = await autovitFetch(`/account/adverts/${advertId}/promotions/`);
  if (!res.ok) return {};
  const data = (await res.json()) as any;
  const out: Record<string, any> = {};
  for (const [code, info] of Object.entries(data.promotions || {})) {
    const i = info as any;
    out[code] = {
      promotion_id: i.promotion_id,
      promotion_code: i.promotion_code,
      promotion_name: i.promotion_name,
      price: i.payments?.account?.price ?? 0,
    };
  }
  return out;
}

/**
 * Deactivate an Autovit advert.
 * Reason IDs (from Autovit docs):
 *   1 = "Other" (default)
 *   2 = "Ad sold on Autovit"
 *   3 = "Ad sold elsewhere"
 *   4 = "No longer for sale"
 */
export async function deactivateAutovitAdvert(
  id: number,
  reasonId: string = "1",
  description: string = "Deactivated from CRM"
): Promise<void> {
  const res = await autovitFetch(`/account/adverts/${id}/deactivate`, {
    method: "POST",
    body: JSON.stringify({
      reason: { id: reasonId, description },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to deactivate advert ${id} (${res.status}): ${err}`);
  }
}

// ─── Image Collections ──────────────────────────────────

export async function createImageCollection(imageUrls: string[]): Promise<{ id: string; images: Record<string, unknown> }> {
  // API expects { "1": "url1", "2": "url2", ... }
  const body: Record<string, string> = {};
  imageUrls.forEach((url, i) => {
    body[String(i + 1)] = url;
  });

  const res = await autovitFetch("/imageCollections", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create image collection (${res.status}): ${err}`);
  }
  return res.json();
}

export async function addImageToCollection(collectionId: string, imageUrl: string): Promise<unknown> {
  const res = await autovitFetch(`/imageCollections/${collectionId}/images`, {
    method: "POST",
    body: JSON.stringify({ source: imageUrl }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add image (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Categories & Metadata ──────────────────────────────

export async function getCategories(): Promise<unknown[]> {
  const res = await autovitFetch("/categories");
  if (!res.ok) throw new Error(`Failed to fetch categories (${res.status})`);
  return res.json();
}

export async function getCategoryMakes(categoryId: number): Promise<unknown[]> {
  const res = await autovitFetch(`/categories/${categoryId}/makes`);
  if (!res.ok) throw new Error(`Failed to fetch makes (${res.status})`);
  return res.json();
}

export async function getCategoryModels(categoryId: number, makeCode: string): Promise<unknown[]> {
  const res = await autovitFetch(`/categories/${categoryId}/models/${makeCode}`);
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`);
  return res.json();
}

/**
 * Get all generations for a make+model on Autovit.
 * Returns mapping of generation code to label (e.g. "gen-ii-2017" -> "II [2017 - Prezent]")
 */
export async function getGenerations(
  makeCode: string,
  modelCode: string
): Promise<Record<string, string>> {
  const res = await autovitFetch(`/categories/29/models/${makeCode}/generations/${modelCode}`);
  if (!res.ok) return {};
  const data = (await res.json()) as { options?: Record<string, { ro?: string; en?: string }> };
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(data.options || {})) {
    out[key] = val.ro || val.en || key;
  }
  return out;
}

/**
 * Get all versions for a make+model (optionally filtered by generation).
 */
export async function getVersions(
  makeCode: string,
  modelCode: string,
  generationCode?: string
): Promise<Record<string, string>> {
  const path = generationCode
    ? `/categories/29/models/${makeCode}/versions/${modelCode}?generation=${generationCode}`
    : `/categories/29/models/${makeCode}/versions/${modelCode}`;
  const res = await autovitFetch(path);
  if (!res.ok) return {};
  const data = (await res.json()) as { options?: Record<string, { ro?: string; en?: string }> };
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(data.options || {})) {
    out[key] = val.ro || val.en || key;
  }
  return out;
}

/**
 * Find best matching version code given a query string (e.g. part of CRM title).
 * Uses word overlap scoring — higher score = better match.
 */
export function findBestVersion(
  query: string,
  versions: Record<string, string>
): string | null {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length > 0 && w !== "other");

  const queryWords = new Set(normalize(query));
  if (queryWords.size === 0) return null;

  let best: { code: string; score: number } | null = null;
  for (const [code, label] of Object.entries(versions)) {
    if (code === "other") continue;
    const labelWords = new Set(normalize(label));
    if (labelWords.size === 0) continue;
    let shared = 0;
    for (const w of queryWords) if (labelWords.has(w)) shared++;
    // Score: prefer high overlap ratio against the label (avoid matching very long labels with only 1 shared word)
    const score = shared / Math.max(labelWords.size, queryWords.size);
    if (!best || score > best.score) best = { code, score };
  }
  // Require at least 50% overlap to avoid bad matches
  return best && best.score >= 0.5 ? best.code : null;
}

/**
 * Auto-detect generation code for a vehicle year.
 * Parses year range from generation label like "II [2017 - Prezent]" or "I [2008 - 2017]".
 */
export function detectGenerationCode(
  year: number,
  generations: Record<string, string>
): string | null {
  for (const [code, label] of Object.entries(generations)) {
    // Match "[YYYY - YYYY]" or "[YYYY - Prezent]"
    const match = label.match(/\[(\d{4})\s*-\s*(\d{4}|Prezent)\]/i);
    if (!match) continue;
    const startYear = Number(match[1]);
    const endYear = match[2].toLowerCase() === "prezent" ? new Date().getFullYear() + 1 : Number(match[2]);
    if (year >= startYear && year <= endYear) {
      return code;
    }
  }
  return null;
}

// ─── Stats ──────────────────────────────────────────────

export async function getAdvertStats(id: number): Promise<unknown> {
  const res = await autovitFetch(`/account/adverts/${id}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats (${res.status})`);
  return res.json();
}

export async function getAccountStatus(): Promise<unknown> {
  const res = await autovitFetch("/account/status");
  if (!res.ok) throw new Error(`Failed to fetch account status (${res.status})`);
  return res.json();
}

// ─── Field Mapping: CRM → Autovit ──────────────────────

const FUEL_MAP: Record<string, string> = {
  BENZINA: "petrol",
  DIESEL: "diesel",
  HYBRID: "hybrid",
  PHEV: "hybrid-plug-in",
  ELECTRIC: "electric",
  GPL: "petrol-lpg",
  PETROL: "petrol",
};

const GEARBOX_MAP: Record<string, string> = {
  MANUAL: "manual",
  MANUALA: "manual",
  AUTOMATIC: "automatic",
  AUTOMATA: "automatic",
};

const BODY_TYPE_MAP: Record<string, string> = {
  SEDAN: "sedan",
  SUV: "suv",
  HATCHBACK: "hatchback",
  WAGON: "station-wagon",
  BREAK: "station-wagon",
  COUPE: "coupe",
  CABRIO: "cabrio",
  CONVERTIBLE: "cabrio",
  MINIVAN: "minivan",
  MONOVOLUM: "minivan",
  PICKUP: "pick-up",
  VAN: "van",
  UTILITARA: "van",
};

// Valid Autovit color codes (from /categories/29 → color param options):
// white, black, gray, silver, blue, red, green, yellow-gold, orange, brown, bej, other
const COLOR_MAP: Record<string, string> = {
  alb: "white",
  negru: "black",
  gri: "gray",
  grii: "gray",
  argint: "silver",
  argintiu: "silver",
  albastru: "blue",
  rosu: "red",
  roșu: "red",
  verde: "green",
  galben: "yellow-gold",
  auriu: "yellow-gold",
  portocaliu: "orange",
  maro: "brown",
  bej: "bej",
  // Colors without direct Autovit match map to "other"
  mov: "other",
  violet: "other",
  bordo: "other",
  bordeaux: "other",
  turcoaz: "other",
};

export interface CrmVehicleForAutovit {
  id: string;
  title: string | null;
  vin: string | null;
  year: number;
  mileage: number | null;
  engineSize: number | null;
  horsepower: number | null;
  batteryCapacity: number | null;
  wltpRange: number | null;
  price: number | null;
  discountPrice: number | null;
  condition: string;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  drivetrain: string | null;
  color: string | null;
  doors: number | null;
  seats: number | null;
  emissions: number | null;
  registrationDate: string | Date | null;
  previousOwners: number | null;
  vatDeductible: boolean;
  availableFinancing: boolean;
  priceNegotiable: boolean;
  noAccidents: boolean;
  serviceRecord: boolean;
  generation: string | null;
  emissionStandard: string | null;
  fuelConsumptionUrban: number | null;
  fuelConsumptionExtraUrban: number | null;
  fuelConsumptionCombined: number | null;
  description: string | null;
  make: { name: string; slug: string };
  model: { name: string; slug: string };
  images: { url: string; order: number }[];
  equipment: { item: { autovitKey: string } }[];
  autovitId: string | null;
}

export async function mapCrmToAutovit(
  vehicle: CrmVehicleForAutovit,
  config: {
    regionId?: number;
    cityId: number;
    districtId?: number;
    contactPerson?: string;
    contactPhones?: string[];
    latitude?: number;
    longitude?: number;
  }
): Promise<AutovitCreateAdvertPayload> {
  const makeSlug = vehicle.make.slug.toLowerCase();
  const modelSlug = vehicle.model.slug.toLowerCase();
  const price = vehicle.discountPrice || vehicle.price || 0;
  const isElectric = vehicle.fuelType?.toUpperCase() === "ELECTRIC";
  const isPHEV = vehicle.fuelType?.toUpperCase() === "PHEV";

  const description = vehicle.description ||
    `${vehicle.make.name} ${vehicle.model.name} ${vehicle.year}` +
    (vehicle.mileage ? `, ${vehicle.mileage} km` : "") +
    (!isElectric && vehicle.engineSize ? `, ${vehicle.engineSize} cm³` : "") +
    (vehicle.horsepower ? `, ${vehicle.horsepower} CP` : "") +
    ((isElectric || isPHEV) && vehicle.batteryCapacity ? `, baterie ${vehicle.batteryCapacity} kWh` : "") +
    ((isElectric || isPHEV) && vehicle.wltpRange ? `, autonomie ${vehicle.wltpRange} km (WLTP)` : "");

  const isUsed = vehicle.condition !== "NEW";
  // Price type: "arranged" = negociabil, "price" = fixed.
  // Used cars are always negotiable by default regardless of CRM field.
  const priceType = isUsed || vehicle.priceNegotiable ? "arranged" : "price";

  const payload: AutovitCreateAdvertPayload = {
    title: vehicle.title || `${vehicle.make.name} ${vehicle.model.name} ${vehicle.year}`,
    description,
    category_id: 29, // Autoturisme
    region_id: config.regionId || 0,
    city_id: config.cityId,
    new_used: isUsed ? "used" : "new",
    advertiser_type: "business",
    params: {
      year: vehicle.year,
      make: makeSlug,
      model: modelSlug,
      price: {
        0: priceType,
        1: price,
        currency: "EUR",
        gross_net: "gross",
      },
      // Required checkbox — default "not imported" (car bought/sold in RO)
      is_imported_car: 0,
    },
  };

  // Dealer warranty for used cars: 12 months (Autovit field is input type — expects string)
  // 20.000 km limit is mentioned in the description since Autovit dealer warranty has no km field
  if (isUsed) {
    payload.params.vendors_warranty_valid_until_date = "12";
  }

  // Version: fetch valid options from Autovit and fuzzy-match from CRM title
  if (vehicle.title) {
    const makeName = vehicle.make.name;
    const modelName = vehicle.model.name;
    // Strip make + model from title to get version query
    let versionQuery = vehicle.title;
    const makeRegex = new RegExp(`${makeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    versionQuery = versionQuery.replace(makeRegex, "");
    const modelRegex = new RegExp(`${modelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    versionQuery = versionQuery.replace(modelRegex, "");
    versionQuery = versionQuery.trim();

    if (versionQuery) {
      try {
        const generationCode = payload.params.generation as string | undefined;
        const versions = await getVersions(makeSlug, modelSlug, generationCode);
        const bestVersion = findBestVersion(versionQuery, versions);
        if (bestVersion) {
          payload.params.version = bestVersion;
        }
      } catch {
        // Version endpoint may fail — not blocking
      }
    }
  }

  if (config.districtId) payload.district_id = config.districtId;

  if (config.contactPerson || config.contactPhones) {
    payload.contact = {};
    if (config.contactPerson) payload.contact.person = config.contactPerson;
    if (config.contactPhones) payload.contact.phones = config.contactPhones;
  }

  if (config.latitude && config.longitude) {
    payload.coordinates = {
      latitude: config.latitude,
      longitude: config.longitude,
    };
  }

  // Map optional params
  if (vehicle.vin) payload.params.vin = vehicle.vin;
  if (vehicle.mileage) payload.params.mileage = vehicle.mileage;
  // Combustion-only: skip engine_capacity for pure electric vehicles
  if (!isElectric && vehicle.engineSize) payload.params.engine_capacity = String(vehicle.engineSize);
  if (vehicle.horsepower) payload.params.engine_power = String(vehicle.horsepower);
  if (vehicle.doors) payload.params.door_count = vehicle.doors;
  if (vehicle.seats) payload.params.seat_count = vehicle.seats;
  if (vehicle.emissions) payload.params.co2_emissions = vehicle.emissions;
  if (vehicle.previousOwners != null) payload.params.previous_owners = vehicle.previousOwners;

  // First registration date — Autovit field is "date_registration"
  if (vehicle.registrationDate) {
    const d = typeof vehicle.registrationDate === "string"
      ? new Date(vehicle.registrationDate)
      : vehicle.registrationDate;
    if (!isNaN(d.getTime())) {
      payload.params.date_registration = d.toISOString().slice(0, 10);
    }
  }

  // Generation: use explicit value or auto-detect from Autovit API based on year
  if (vehicle.generation) {
    payload.params.generation = vehicle.generation;
  } else {
    try {
      const generations = await getGenerations(makeSlug, modelSlug);
      const genCode = detectGenerationCode(vehicle.year, generations);
      if (genCode) payload.params.generation = genCode;
    } catch {
      // Generation endpoint may fail — not blocking
    }
  }

  // Pollution standard (Euro 5/6)
  if (vehicle.emissionStandard) payload.params.pollution_standard = vehicle.emissionStandard;

  // Fuel consumption (l/100km) — exact Autovit field names
  if (vehicle.fuelConsumptionUrban) payload.params.urban_consumption = String(vehicle.fuelConsumptionUrban);
  if (vehicle.fuelConsumptionExtraUrban) payload.params.extra_urban_consumption = String(vehicle.fuelConsumptionExtraUrban);
  if (vehicle.fuelConsumptionCombined) payload.params.combined_consumption = String(vehicle.fuelConsumptionCombined);

  // Required status checkboxes (derived from CRM)
  // Note: "price_negotiable" does NOT exist in Autovit API — stored in CRM for internal use only
  payload.params.vat = vehicle.vatDeductible ? 1 : 0;
  payload.params.financial_option = vehicle.availableFinancing ? 1 : 0;
  if (vehicle.noAccidents) payload.params.no_accident = 1;
  if (vehicle.serviceRecord) payload.params.service_record = 1;

  // Electric / PHEV specific params
  if ((isElectric || isPHEV) && vehicle.batteryCapacity) {
    payload.params.battery_capacity = vehicle.batteryCapacity;
  }
  if ((isElectric || isPHEV) && vehicle.wltpRange) {
    payload.params.autonomy = vehicle.wltpRange;
  }

  if (vehicle.fuelType) {
    payload.params.fuel_type = FUEL_MAP[vehicle.fuelType.toUpperCase()] || vehicle.fuelType.toLowerCase();
  }
  if (vehicle.transmission) {
    payload.params.gearbox = GEARBOX_MAP[vehicle.transmission.toUpperCase()] || vehicle.transmission.toLowerCase();
  }
  if (vehicle.bodyType) {
    payload.params.body_type = BODY_TYPE_MAP[vehicle.bodyType.toUpperCase()] || vehicle.bodyType.toLowerCase();
  }
  if (vehicle.color) {
    const colorKey = Object.keys(COLOR_MAP).find((k) =>
      vehicle.color!.toLowerCase().includes(k.toLowerCase())
    );
    if (colorKey) payload.params.color = COLOR_MAP[colorKey];
  }

  // Equipment items map directly to Autovit boolean params via autovitKey
  // (e.g. quick_charging_function, vehicle_charging_cable, energy_recovery_system,
  //  bluetooth_interface, navigation_system, etc.)
  for (const eq of vehicle.equipment) {
    if (eq.item.autovitKey) {
      payload.params[eq.item.autovitKey] = 1;
    }
  }

  return payload;
}

// ─── Check if configured ────────────────────────────────

export function isAutovitConfigured(): boolean {
  return !!(
    process.env.AUTOVIT_CLIENT_ID &&
    process.env.AUTOVIT_CLIENT_SECRET &&
    process.env.AUTOVIT_USERNAME &&
    process.env.AUTOVIT_PASSWORD
  );
}

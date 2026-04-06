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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Number(clientId),
      client_secret: clientSecret,
      grant_type: "password",
      username,
      password,
    }),
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

export async function deactivateAutovitAdvert(id: number): Promise<void> {
  const res = await autovitFetch(`/account/adverts/${id}/deactivate`, { method: "POST" });
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

const COLOR_MAP: Record<string, string> = {
  Alb: "white",
  Negru: "black",
  Gri: "grey",
  Argint: "silver",
  Albastru: "blue",
  Rosu: "red",
  Verde: "green",
  Galben: "yellow",
  Portocaliu: "orange",
  Maro: "brown",
  Bej: "beige",
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
  description: string | null;
  make: { name: string; slug: string };
  model: { name: string; slug: string };
  images: { url: string; order: number }[];
  equipment: { item: { autovitKey: string } }[];
  autovitId: string | null;
}

export function mapCrmToAutovit(
  vehicle: CrmVehicleForAutovit,
  config: {
    regionId: number;
    cityId: number;
    districtId?: number;
    contactPerson?: string;
    contactPhones?: string[];
    latitude?: number;
    longitude?: number;
  }
): AutovitCreateAdvertPayload {
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

  const payload: AutovitCreateAdvertPayload = {
    title: vehicle.title || `${vehicle.make.name} ${vehicle.model.name} ${vehicle.year}`,
    description,
    category_id: 29, // Autoturisme
    region_id: config.regionId,
    city_id: config.cityId,
    new_used: vehicle.condition === "NEW" ? "new" : "used",
    advertiser_type: "business",
    params: {
      year: vehicle.year,
      make: makeSlug,
      model: modelSlug,
      price: {
        0: "price",
        1: price,
        currency: "EUR",
        gross_net: "gross",
      },
    },
  };

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

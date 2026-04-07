import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

const SETTINGS_KEY = "autovit_dealer_config";

interface AutovitDealerConfig {
  regionId: number | null;
  regionName: string | null;
  cityId: number | null;
  cityName: string | null;
  districtsCityId: number | null;
  districtId: number | null;
  districtName: string | null;
  contactPerson: string;
  contactPhones: string[];
  latitude: number | null;
  longitude: number | null;
  advertiserType: "business" | "private";
  defaultDescriptionSuffix: string;
}

const EMPTY_CONFIG: AutovitDealerConfig = {
  regionId: null,
  regionName: null,
  cityId: null,
  cityName: null,
  districtsCityId: null,
  districtId: null,
  districtName: null,
  contactPerson: "",
  contactPhones: [],
  latitude: null,
  longitude: null,
  advertiserType: "business",
  defaultDescriptionSuffix: "",
};

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.siteSettings.findUnique({
    where: { key: SETTINGS_KEY },
  });

  const config: AutovitDealerConfig = record
    ? { ...EMPTY_CONFIG, ...(record.value as unknown as AutovitDealerConfig) }
    : EMPTY_CONFIG;

  return NextResponse.json({ config });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Doar adminii pot modifica setarile Autovit" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const config: AutovitDealerConfig = {
    regionId: body.regionId ? Number(body.regionId) : null,
    regionName: body.regionName || null,
    cityId: body.cityId ? Number(body.cityId) : null,
    cityName: body.cityName || null,
    districtsCityId: body.districtsCityId ? Number(body.districtsCityId) : null,
    districtId: body.districtId ? Number(body.districtId) : null,
    districtName: body.districtName || null,
    contactPerson: body.contactPerson || "",
    contactPhones: Array.isArray(body.contactPhones)
      ? body.contactPhones.filter((p: string) => p && p.trim())
      : [],
    latitude: body.latitude ? Number(body.latitude) : null,
    longitude: body.longitude ? Number(body.longitude) : null,
    advertiserType: body.advertiserType === "private" ? "private" : "business",
    defaultDescriptionSuffix: body.defaultDescriptionSuffix || "",
  };

  await prisma.siteSettings.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: config as any },
    create: { key: SETTINGS_KEY, value: config as any },
  });

  return NextResponse.json({ success: true, config });
}

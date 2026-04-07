import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@autoerebus/database";
import AutovitSettingsClient from "./autovit-settings-client";

export const dynamic = "force-dynamic";

export default async function AutovitSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") redirect("/dashboard");

  const record = await prisma.siteSettings.findUnique({
    where: { key: "autovit_dealer_config" },
  });

  const emptyConfig = {
    regionId: null,
    regionName: null,
    cityId: null,
    cityName: null,
    districtsCityId: null,
    districtId: null,
    districtName: null,
    contactPerson: "",
    contactPhones: [] as string[],
    latitude: null,
    longitude: null,
    advertiserType: "business" as "business" | "private",
    defaultDescriptionSuffix: "",
  };

  const config = record ? { ...emptyConfig, ...(record.value as any) } : emptyConfig;

  return <AutovitSettingsClient initialConfig={config} />;
}

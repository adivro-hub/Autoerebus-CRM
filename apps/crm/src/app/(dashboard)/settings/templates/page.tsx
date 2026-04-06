import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@autoerebus/database";
import TemplatesClient from "./templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") redirect("/dashboard");

  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ channel: "asc" }, { key: "asc" }],
  });

  return <TemplatesClient initialTemplates={templates} />;
}

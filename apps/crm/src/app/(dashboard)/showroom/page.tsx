export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import ShowroomClient from "./showroom-client";

export const metadata = { title: "Întâlniri Showroom" };

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function ShowroomPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const brand = params.brand && params.brand !== "ALL" ? params.brand : undefined;

  let appointments: unknown[] = [];

  try {
    const where: Record<string, unknown> = {};
    if (brand) where.brand = brand;

    appointments = await prisma.showroomAppointment.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });
  } catch {
    // DB not available
  }

  return (
    <ShowroomClient
      key={brand || "ALL"}
      initialAppointments={JSON.parse(JSON.stringify(appointments))}
    />
  );
}

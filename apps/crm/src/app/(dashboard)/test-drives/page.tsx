export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import TestDrivesClient from "./test-drives-client";

export const metadata = {
  title: "Test Drive",
};

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function TestDrivesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const brand = params.brand && params.brand !== "ALL" ? params.brand : undefined;

  let testDrives: unknown[] = [];

  try {
    const where: Record<string, unknown> = {};
    if (brand) where.brand = brand;

    testDrives = await prisma.testDrive.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        vehicle: {
          select: {
            id: true,
            year: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        agent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });
  } catch {
    // DB not available
  }

  return <TestDrivesClient key={brand || "ALL"} initialTestDrives={JSON.parse(JSON.stringify(testDrives))} />;
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { getUserBrands } from "@/lib/team-auth";

/**
 * GET /api/demo-bookings/available-vehicles
 * Returns vehicles that can be reserved for demo, filtered by user's team brands.
 * Excludes SERVICE brand. Only returns vehicles with availableTestDrive = true.
 */
export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";
  const userBrands = await getUserBrands(session.user.id, isSuperAdmin);
  // Exclude SERVICE
  const allowedBrands = userBrands.filter((b) => b !== "SERVICE");

  if (allowedBrands.length === 0) {
    return NextResponse.json({ vehicles: [] });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      availableTestDrive: true,
      brand: { in: allowedBrands as any[] },
    },
    select: {
      id: true,
      title: true,
      brand: true,
      year: true,
      price: true,
      make: { select: { name: true } },
      model: { select: { name: true } },
      images: { take: 1, orderBy: { order: "asc" }, select: { url: true } },
      demoBookings: {
        where: { status: { in: ["APPROVED", "PENDING"] } },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          user: { select: { firstName: true, lastName: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startDate: "asc" },
      },
      testDrives: {
        where: {
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          scheduledAt: { gte: new Date() },
        },
        select: { id: true, scheduledAt: true, status: true },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      },
    },
    orderBy: { brand: "asc" },
  });

  return NextResponse.json({ vehicles });
}

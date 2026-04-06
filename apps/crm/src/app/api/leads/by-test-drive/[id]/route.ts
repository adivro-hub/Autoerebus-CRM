import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/by-test-drive/[id]
 * Returns the lead associated with a test drive (by customer + vehicle match)
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: testDriveId } = await params;

  const td = await prisma.testDrive.findUnique({
    where: { id: testDriveId },
    select: { customerId: true, vehicleId: true },
  });

  if (!td) {
    return NextResponse.json({ error: "Test drive nu există" }, { status: 404 });
  }

  // Find lead by customer + vehicle (primary or additional)
  const lead = await prisma.lead.findFirst({
    where: {
      customerId: td.customerId,
      OR: [
        { vehicleId: td.vehicleId },
        { additionalVehicleIds: { has: td.vehicleId } },
      ],
    },
    select: { id: true, status: true, brand: true },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) {
    // Fallback: any lead for this customer
    const anyLead = await prisma.lead.findFirst({
      where: { customerId: td.customerId },
      select: { id: true, status: true, brand: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ lead: anyLead });
  }

  return NextResponse.json({ lead });
}

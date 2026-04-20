import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Access control:
  // - SUPER_ADMIN / ADMIN / MANAGER → always allowed
  // - Others (AGENT, RECEPTION) → only if the customer has a lead/TD/service-order
  //   in at least one of the user's allowed brands
  const userRole = (session.user as { role?: string })?.role;
  const userBrands = ((session.user as { brands?: string[] })?.brands as string[]) || [];
  const isManagerOrAbove =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER";

  if (!isManagerOrAbove) {
    if (userBrands.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [leadInBrand, tdInBrand, soInBrand] = await Promise.all([
      prisma.lead.count({ where: { customerId: id, brand: { in: userBrands as never[] } } }),
      prisma.testDrive.count({ where: { customerId: id, brand: { in: userBrands as never[] } } }),
      prisma.serviceOrder.count({ where: { customerId: id, brand: { in: userBrands as never[] } } }),
    ]);
    if (leadInBrand + tdInBrand + soInBrand === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const [customer, leads, testDrives, serviceOrders] = await Promise.all([
      prisma.customer.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          source: true,
          type: true,
          company: true,
          city: true,
          county: true,
          createdAt: true,
        },
      }),
      prisma.lead.findMany({
        where: { customerId: id },
        select: {
          id: true,
          status: true,
          source: true,
          brand: true,
          notes: true,
          createdAt: true,
          vehicle: {
            select: {
              title: true,
              make: { select: { name: true } },
              model: { select: { name: true } },
              year: true,
            },
          },
          deals: {
            select: {
              stage: { select: { name: true, color: true } },
              value: true,
              currency: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.testDrive.findMany({
        where: { customerId: id },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          brand: true,
          feedback: true,
          notes: true,
          vehicle: {
            select: {
              title: true,
              make: { select: { name: true } },
              model: { select: { name: true } },
              year: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      }),
      prisma.serviceOrder.findMany({
        where: { customerId: id },
        select: {
          id: true,
          status: true,
          type: true,
          createdAt: true,
          description: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { customer, leads, testDrives, serviceOrders },
    });
  } catch (error: unknown) {
    console.error("Customer history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { SALES_PIPELINE_STAGES } from "@autoerebus/types";
import { auth } from "@/lib/auth";
import SalesClient from "./sales-client";

export const metadata = {
  title: "Vanzari",
};

interface PageProps {
  searchParams: Promise<{ brand?: string }>;
}

export default async function SalesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;
  const userBrands = ((session?.user as { brands?: string[] })?.brands as string[]) || [];
  const isRestricted = userRole !== "SUPER_ADMIN" && userBrands.length > 0;

  // Brand filter logic:
  // - "ALL" or no brand: show all for unrestricted, or all user's allowed brands for restricted
  // - Specific brand: show just that one (if user has access)
  const urlBrand = params.brand && params.brand !== "ALL" ? params.brand : undefined;
  let brandFilter: string | { in: string[] } | undefined;
  if (urlBrand) {
    if (isRestricted && !userBrands.includes(urlBrand)) {
      // User requested brand they don't have → fallback to their brands
      brandFilter = { in: userBrands };
    } else {
      brandFilter = urlBrand;
    }
  } else if (isRestricted) {
    brandFilter = { in: userBrands };
  }

  let leads: unknown[] = [];
  let stages: unknown[] = [];
  let agents: unknown[] = [];
  let activeTestDrives: unknown[] = [];
  let activeShowrooms: unknown[] = [];

  try {
    const leadWhere: Record<string, unknown> = {};
    if (brandFilter) leadWhere.brand = brandFilter;

    leads = await prisma.lead.findMany({
      where: leadWhere,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            title: true,
            year: true,
            price: true,
            discountPrice: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { deals: true } },
      },
    });

    agents = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"] } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    });

    activeTestDrives = await prisma.testDrive.findMany({
      where: {
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        ...(brandFilter ? { brand: brandFilter as never } : {}),
      },
      select: {
        id: true,
        customerId: true,
        leadId: true,
        vehicleId: true,
        scheduledAt: true,
        status: true,
        brand: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    activeShowrooms = await prisma.showroomAppointment.findMany({
      where: {
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        ...(brandFilter ? { brand: brandFilter as never } : {}),
      },
      select: {
        id: true,
        customerId: true,
        leadId: true,
        scheduledAt: true,
        duration: true,
        status: true,
        brand: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    // Fetch ALL sales pipeline stages (client filters per lead brand)
    stages = await prisma.pipelineStage.findMany({
      where: { pipelineType: "SALES" },
      orderBy: { order: "asc" },
      include: {
        deals: {
          include: {
            lead: {
              select: {
                id: true,
                source: true,
                type: true,
                additionalVehicleIds: true,
                customer: { select: { firstName: true, lastName: true } },
                vehicle: {
                  select: {
                    make: { select: { name: true } },
                    model: { select: { name: true } },
                    price: true,
                    discountPrice: true,
                  },
                },
              },
            },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    // Resolve additionalVehicleIds to vehicle data
    const allAdditionalIds = new Set<string>();
    (stages as { deals: { lead: { additionalVehicleIds?: string[] } }[] }[]).forEach((s) =>
      s.deals.forEach((d) =>
        (d.lead.additionalVehicleIds || []).forEach((id) => allAdditionalIds.add(id))
      )
    );
    if (allAdditionalIds.size > 0) {
      const additionalVehicles = await prisma.vehicle.findMany({
        where: { id: { in: Array.from(allAdditionalIds) } },
        select: { id: true, make: { select: { name: true } }, model: { select: { name: true } }, price: true, discountPrice: true },
      });
      const vehicleMap = new Map(additionalVehicles.map((v) => [v.id, v]));
      (stages as { deals: { lead: { additionalVehicleIds?: string[]; additionalVehicles?: unknown[] } }[] }[]).forEach((s) =>
        s.deals.forEach((d) => {
          d.lead.additionalVehicles = (d.lead.additionalVehicleIds || [])
            .map((id) => vehicleMap.get(id))
            .filter(Boolean);
        })
      );
    }
  } catch {
    stages = SALES_PIPELINE_STAGES.map((s) => ({
      id: s.name,
      name: s.name,
      order: s.order,
      color: s.color,
      deals: [],
    }));
  }

  return (
    <SalesClient
      key={typeof brandFilter === "string" ? brandFilter : "ALL"}
      initialLeads={JSON.parse(JSON.stringify(leads))}
      initialStages={JSON.parse(JSON.stringify(stages))}
      agents={JSON.parse(JSON.stringify(agents))}
      activeTestDrives={JSON.parse(JSON.stringify(activeTestDrives))}
      activeShowrooms={JSON.parse(JSON.stringify(activeShowrooms))}
    />
  );
}

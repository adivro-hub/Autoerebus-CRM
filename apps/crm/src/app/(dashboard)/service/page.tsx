export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import ServiceClient from "./service-client";

export const metadata = {
  title: "Service",
};

export default async function ServicePage() {
  let orders: unknown[] = [];
  let agents: unknown[] = [];

  try {
    const [ordersResult, agentsResult] = await Promise.all([
      prisma.serviceOrder.findMany({
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          vehicle: {
            include: {
              make: { select: { name: true } },
              model: { select: { name: true } },
            },
          },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          activities: {
            select: { id: true, type: true, content: true, createdAt: true },
            orderBy: { createdAt: "desc" as const },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"] } },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);
    orders = ordersResult;
    agents = agentsResult;
  } catch (e) {
    console.error("Service page fetch error:", e);
  }

  return (
    <ServiceClient
      initialOrders={JSON.parse(JSON.stringify(orders))}
      agents={JSON.parse(JSON.stringify(agents))}
    />
  );
}

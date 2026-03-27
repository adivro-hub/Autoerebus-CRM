import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";

const router = Router();

// GET /stats - Aggregate counts and revenue
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { brand } = req.query;

    const vehicleWhere = brand ? { brand: brand as any } : {};
    const leadWhere = brand ? { brand: brand as any } : {};
    const dealWhere = brand ? { brand: brand as any } : {};
    const serviceWhere = brand ? { brand: brand as any } : {};
    const testDriveWhere = brand ? { brand: brand as any } : {};

    const [
      totalVehicles,
      availableVehicles,
      totalLeads,
      newLeads,
      totalDeals,
      openDeals,
      totalServiceOrders,
      activeServiceOrders,
      totalClaims,
      activeClaims,
      totalTestDrives,
      upcomingTestDrives,
      revenue,
      monthlyLeads,
    ] = await Promise.all([
      prisma.vehicle.count({ where: vehicleWhere }),
      prisma.vehicle.count({ where: { ...vehicleWhere, status: "AVAILABLE" } }),
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({
        where: { ...leadWhere, status: "NEW" },
      }),
      prisma.deal.count({ where: dealWhere }),
      prisma.deal.count({
        where: {
          ...dealWhere,
          stage: { name: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
        },
      }),
      prisma.serviceOrder.count({ where: serviceWhere }),
      prisma.serviceOrder.count({
        where: {
          ...serviceWhere,
          status: { in: ["SCHEDULED", "RECEIVED", "IN_PROGRESS", "WAITING_PARTS"] },
        },
      }),
      prisma.claim.count(),
      prisma.claim.count({
        where: {
          status: { in: ["OPENED", "DOCUMENTS_PENDING", "UNDER_REVIEW", "APPROVED", "IN_REPAIR"] },
        },
      }),
      prisma.testDrive.count({ where: testDriveWhere }),
      prisma.testDrive.count({
        where: {
          ...testDriveWhere,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          scheduledAt: { gte: new Date() },
        },
      }),
      prisma.deal.aggregate({
        where: {
          ...dealWhere,
          stage: { name: "CLOSED_WON" },
        },
        _sum: { value: true },
      }),
      prisma.lead.count({
        where: {
          ...leadWhere,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          available: availableVehicles,
        },
        leads: {
          total: totalLeads,
          new: newLeads,
          thisMonth: monthlyLeads,
        },
        deals: {
          total: totalDeals,
          open: openDeals,
          revenue: revenue._sum.value || 0,
        },
        serviceOrders: {
          total: totalServiceOrders,
          active: activeServiceOrders,
        },
        claims: {
          total: totalClaims,
          active: activeClaims,
        },
        testDrives: {
          total: totalTestDrives,
          upcoming: upcomingTestDrives,
        },
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea statisticilor" });
  }
});

// GET /recent-activity - Recent activities across all modules
router.get("/recent-activity", async (req: Request, res: Response) => {
  try {
    const { limit = "20", brand } = req.query;
    const take = Math.min(Number(limit), 50);

    const where = brand
      ? {
          OR: [
            { lead: { brand: brand as any } },
            { deal: { brand: brand as any } },
          ],
        }
      : {};

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        lead: {
          select: {
            id: true,
            brand: true,
            status: true,
            customer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        deal: {
          select: {
            id: true,
            brand: true,
            value: true,
            stage: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    // Also get recent audit logs for broader activity context
    const auditLogs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    res.json({
      success: true,
      data: {
        activities,
        auditLogs,
      },
    });
  } catch (error) {
    console.error("Get recent activity error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea activității recente" });
  }
});

export { router as dashboardRoutes };

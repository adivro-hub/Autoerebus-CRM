import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /calendar - Test drives for calendar view, grouped by date
router.get("/calendar", async (req: Request, res: Response) => {
  try {
    const { from, to, brand, agentId } = req.query;

    const where: Prisma.TestDriveWhereInput = {};

    if (brand) where.brand = brand as any;
    if (agentId) where.agentId = String(agentId);

    // Default: current month
    const startDate = from
      ? new Date(String(from))
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = to
      ? new Date(String(to))
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    where.scheduledAt = {
      gte: startDate,
      lte: endDate,
    };

    const testDrives = await prisma.testDrive.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        agent: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    // Group by date string (YYYY-MM-DD)
    const grouped: Record<string, typeof testDrives> = {};
    for (const td of testDrives) {
      const dateKey = td.scheduledAt.toISOString().split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(td);
    }

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Get calendar error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea calendarului" });
  }
});

// GET / - List test drives with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      brand,
      status,
      agentId,
      dateFrom,
      dateTo,
      search,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.TestDriveWhereInput = {};

    if (brand) where.brand = brand as any;
    if (status) where.status = status as any;
    if (agentId) where.agentId = String(agentId);

    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) where.scheduledAt.gte = new Date(String(dateFrom));
      if (dateTo) where.scheduledAt.lte = new Date(String(dateTo));
    }

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { customer: { firstName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { lastName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { phone: { contains: searchStr, mode: "insensitive" } } },
        { notes: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [testDrives, total] = await Promise.all([
      prisma.testDrive.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          vehicle: {
            include: {
              make: { select: { name: true } },
              model: { select: { name: true } },
            },
          },
          agent: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { scheduledAt: "desc" },
        skip,
        take,
      }),
      prisma.testDrive.count({ where }),
    ]);

    res.json({
      success: true,
      data: testDrives,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List test drives error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea test drive-urilor" });
  }
});

// GET /:id - Single test drive
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const testDrive = await prisma.testDrive.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        vehicle: {
          include: {
            make: true,
            model: true,
            images: { orderBy: { order: "asc" }, take: 3 },
          },
        },
        agent: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true },
        },
      },
    });

    if (!testDrive) {
      res.status(404).json({ success: false, error: "Test drive-ul nu a fost găsit" });
      return;
    }

    res.json({ success: true, data: testDrive });
  } catch (error) {
    console.error("Get test drive error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea test drive-ului" });
  }
});

// POST / - Schedule test drive
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      customerId, vehicleId, scheduledAt,
      duration, brand, agentId, notes,
    } = req.body;

    if (!customerId || !vehicleId || !scheduledAt || !brand) {
      res.status(400).json({
        success: false,
        error: "customerId, vehicleId, scheduledAt și brand sunt obligatorii",
      });
      return;
    }

    // Verify customer and vehicle exist
    const [customer, vehicle] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    ]);

    if (!customer) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }
    if (!vehicle) {
      res.status(404).json({ success: false, error: "Vehiculul nu a fost găsit" });
      return;
    }

    // Check for scheduling conflicts (same vehicle, overlapping time)
    const scheduledDate = new Date(scheduledAt);
    const durationMin = duration || 30;
    const endTime = new Date(scheduledDate.getTime() + durationMin * 60000);

    const conflict = await prisma.testDrive.findFirst({
      where: {
        vehicleId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: {
          lt: endTime,
          gte: new Date(scheduledDate.getTime() - durationMin * 60000),
        },
      },
    });

    if (conflict) {
      res.status(409).json({
        success: false,
        error: "Vehiculul este deja programat pentru un test drive în acest interval",
      });
      return;
    }

    const testDrive = await prisma.testDrive.create({
      data: {
        customerId,
        vehicleId,
        scheduledAt: scheduledDate,
        duration: durationMin,
        brand,
        agentId: agentId || req.user!.id,
        notes: notes || null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        agent: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "TestDrive",
        entityId: testDrive.id,
        userId: req.user!.id,
        details: { brand: testDrive.brand, scheduledAt: testDrive.scheduledAt },
      },
    });

    res.status(201).json({ success: true, data: testDrive });
  } catch (error) {
    console.error("Create test drive error:", error);
    res.status(500).json({ success: false, error: "Eroare la programarea test drive-ului" });
  }
});

// PATCH /:id - Update test drive status
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.testDrive.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Test drive-ul nu a fost găsit" });
      return;
    }

    const {
      status, scheduledAt, duration,
      agentId, notes, feedback,
    } = req.body;

    const data: Prisma.TestDriveUpdateInput = {};

    if (status !== undefined) data.status = status;
    if (scheduledAt !== undefined) data.scheduledAt = new Date(scheduledAt);
    if (duration !== undefined) data.duration = Number(duration);
    if (agentId !== undefined) data.agent = agentId ? { connect: { id: agentId } } : { disconnect: true };
    if (notes !== undefined) data.notes = notes || null;
    if (feedback !== undefined) data.feedback = feedback || null;

    const testDrive = await prisma.testDrive.update({
      where: { id: req.params.id },
      data,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        agent: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "TestDrive",
        entityId: testDrive.id,
        userId: req.user!.id,
        details: {
          updatedFields: Object.keys(req.body),
          statusChange: status && status !== existing.status
            ? { from: existing.status, to: status }
            : undefined,
        },
      },
    });

    res.json({ success: true, data: testDrive });
  } catch (error) {
    console.error("Update test drive error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea test drive-ului" });
  }
});

export { router as testDriveRoutes };

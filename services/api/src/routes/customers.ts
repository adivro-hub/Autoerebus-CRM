import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET / - List customers with search and filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      search,
      type,
      source,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.CustomerWhereInput = {};

    if (type) where.type = type as any;
    if (source) where.source = source as any;

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { firstName: { contains: searchStr, mode: "insensitive" } },
        { lastName: { contains: searchStr, mode: "insensitive" } },
        { email: { contains: searchStr, mode: "insensitive" } },
        { phone: { contains: searchStr, mode: "insensitive" } },
        { company: { contains: searchStr, mode: "insensitive" } },
        { cui: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: {
              leads: true,
              serviceOrders: true,
              claims: true,
              testDrives: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List customers error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea clienților" });
  }
});

// GET /:id - Single customer with relations
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        customerNotes: {
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
        leads: {
          include: {
            vehicle: {
              select: { id: true, brand: true, year: true },
              include: {
                make: { select: { name: true } },
                model: { select: { name: true } },
              } as any,
            },
            assignedTo: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        serviceOrders: {
          include: {
            vehicle: {
              select: { id: true, brand: true, year: true },
              include: {
                make: { select: { name: true } },
                model: { select: { name: true } },
              } as any,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        claims: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        testDrives: {
          include: {
            vehicle: {
              include: {
                make: { select: { name: true } },
                model: { select: { name: true } },
              },
            },
          },
          orderBy: { scheduledAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea clientului" });
  }
});

// POST / - Create customer
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      firstName, lastName, email, phone, company, cui,
      type, source, gdprConsent, address, city, county, notes,
    } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: "Prenumele și numele sunt obligatorii",
      });
      return;
    }

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        email: email?.toLowerCase() || null,
        phone: phone || null,
        company: company || null,
        cui: cui || null,
        type: type || "INDIVIDUAL",
        source: source || null,
        gdprConsent: gdprConsent || false,
        gdprDate: gdprConsent ? new Date() : null,
        address: address || null,
        city: city || null,
        county: county || null,
        notes: notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Customer",
        entityId: customer.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({ success: false, error: "Eroare la crearea clientului" });
  }
});

// PATCH /:id - Update customer
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    const {
      firstName, lastName, email, phone, company, cui,
      type, source, gdprConsent, address, city, county, notes,
    } = req.body;

    const data: Prisma.CustomerUpdateInput = {};

    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (email !== undefined) data.email = email?.toLowerCase() || null;
    if (phone !== undefined) data.phone = phone || null;
    if (company !== undefined) data.company = company || null;
    if (cui !== undefined) data.cui = cui || null;
    if (type !== undefined) data.type = type;
    if (source !== undefined) data.source = source;
    if (gdprConsent !== undefined) {
      data.gdprConsent = gdprConsent;
      if (gdprConsent && !existing.gdprDate) {
        data.gdprDate = new Date();
      }
    }
    if (address !== undefined) data.address = address || null;
    if (city !== undefined) data.city = city || null;
    if (county !== undefined) data.county = county || null;
    if (notes !== undefined) data.notes = notes || null;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Customer",
        entityId: customer.id,
        userId: req.user!.id,
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea clientului" });
  }
});

// DELETE /:id - Delete customer (soft considerations)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { leads: true, serviceOrders: true, claims: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    // Prevent deletion if customer has active relationships
    const totalRelations =
      existing._count.leads + existing._count.serviceOrders + existing._count.claims;

    if (totalRelations > 0) {
      res.status(409).json({
        success: false,
        error: `Clientul nu poate fi șters deoarece are ${existing._count.leads} lead-uri, ${existing._count.serviceOrders} comenzi service și ${existing._count.claims} daune asociate. Ștergeți mai întâi relațiile.`,
      });
      return;
    }

    await prisma.customerNote.deleteMany({ where: { customerId: req.params.id } });
    await prisma.customer.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Customer",
        entityId: req.params.id,
        userId: req.user!.id,
      },
    });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ success: false, error: "Eroare la ștergerea clientului" });
  }
});

export { router as customerRoutes };

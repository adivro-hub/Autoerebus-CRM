import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /pipeline - Claims grouped by status
router.get("/pipeline", async (req: Request, res: Response) => {
  try {
    const claims = await prisma.claim.findMany({
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
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const statuses = [
      "OPENED", "DOCUMENTS_PENDING", "UNDER_REVIEW",
      "APPROVED", "IN_REPAIR", "COMPLETED", "REJECTED", "CLOSED",
    ];

    const pipeline = statuses.map((status) => ({
      status,
      claims: claims.filter((c) => c.status === status),
      count: claims.filter((c) => c.status === status).length,
    }));

    res.json({ success: true, data: pipeline });
  } catch (error) {
    console.error("Get claims pipeline error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea pipeline-ului daune" });
  }
});

// GET / - List claims with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      status,
      assignedTo,
      search,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.ClaimWhereInput = {};

    if (status) where.status = status as any;
    if (assignedTo) where.assignedToId = String(assignedTo);

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { claimNumber: { contains: searchStr, mode: "insensitive" } },
        { insuranceCompany: { contains: searchStr, mode: "insensitive" } },
        { policyNumber: { contains: searchStr, mode: "insensitive" } },
        { description: { contains: searchStr, mode: "insensitive" } },
        { customer: { firstName: { contains: searchStr, mode: "insensitive" } } },
        { customer: { lastName: { contains: searchStr, mode: "insensitive" } } },
      ];
    }

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
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
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { documents: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.claim.count({ where }),
    ]);

    res.json({
      success: true,
      data: claims,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List claims error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea daunelor" });
  }
});

// GET /:id - Single claim with documents
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        vehicle: {
          include: {
            make: true,
            model: true,
            images: { orderBy: { order: "asc" }, take: 1 },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!claim) {
      res.status(404).json({ success: false, error: "Dauna nu a fost găsită" });
      return;
    }

    res.json({ success: true, data: claim });
  } catch (error) {
    console.error("Get claim error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea daunei" });
  }
});

// POST / - Create claim
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      customerId, vehicleId, insuranceCompany, policyNumber,
      description, incidentDate, estimatedCost,
      currency, assignedToId, notes,
    } = req.body;

    if (!customerId) {
      res.status(400).json({
        success: false,
        error: "customerId este obligatoriu",
      });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: "Clientul nu a fost găsit" });
      return;
    }

    const claim = await prisma.claim.create({
      data: {
        customerId,
        vehicleId: vehicleId || null,
        insuranceCompany: insuranceCompany || null,
        policyNumber: policyNumber || null,
        description: description || null,
        incidentDate: incidentDate ? new Date(incidentDate) : null,
        estimatedCost: estimatedCost ? Number(estimatedCost) : null,
        currency: currency || "EUR",
        assignedToId: assignedToId || null,
        notes: notes || null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Claim",
        entityId: claim.id,
        userId: req.user!.id,
        details: { claimNumber: claim.claimNumber },
      },
    });

    res.status(201).json({ success: true, data: claim });
  } catch (error) {
    console.error("Create claim error:", error);
    res.status(500).json({ success: false, error: "Eroare la crearea daunei" });
  }
});

// PATCH /:id - Update claim
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.claim.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Dauna nu a fost găsită" });
      return;
    }

    const {
      status, insuranceCompany, policyNumber,
      description, incidentDate, estimatedCost, actualCost,
      currency, assignedToId, notes,
    } = req.body;

    const data: Prisma.ClaimUpdateInput = {};

    if (status !== undefined) data.status = status;
    if (insuranceCompany !== undefined) data.insuranceCompany = insuranceCompany || null;
    if (policyNumber !== undefined) data.policyNumber = policyNumber || null;
    if (description !== undefined) data.description = description || null;
    if (incidentDate !== undefined) data.incidentDate = incidentDate ? new Date(incidentDate) : null;
    if (estimatedCost !== undefined) data.estimatedCost = estimatedCost ? Number(estimatedCost) : null;
    if (actualCost !== undefined) data.actualCost = actualCost ? Number(actualCost) : null;
    if (currency !== undefined) data.currency = currency;
    if (assignedToId !== undefined) data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (notes !== undefined) data.notes = notes || null;

    const claim = await prisma.claim.update({
      where: { id: req.params.id },
      data,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Claim",
        entityId: claim.id,
        userId: req.user!.id,
        details: {
          updatedFields: Object.keys(req.body),
          statusChange: status && status !== existing.status
            ? { from: existing.status, to: status }
            : undefined,
        },
      },
    });

    res.json({ success: true, data: claim });
  } catch (error) {
    console.error("Update claim error:", error);
    res.status(500).json({ success: false, error: "Eroare la actualizarea daunei" });
  }
});

// POST /:id/documents - Add document metadata to claim
router.post("/:id/documents", async (req: Request, res: Response) => {
  try {
    const claim = await prisma.claim.findUnique({ where: { id: req.params.id } });
    if (!claim) {
      res.status(404).json({ success: false, error: "Dauna nu a fost găsită" });
      return;
    }

    const { name, url, type, size } = req.body;

    if (!name || !url) {
      res.status(400).json({
        success: false,
        error: "Numele și URL-ul documentului sunt obligatorii",
      });
      return;
    }

    const document = await prisma.claimDocument.create({
      data: {
        claimId: req.params.id,
        name,
        url,
        type: type || null,
        size: size ? Number(size) : null,
      },
    });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    console.error("Add claim document error:", error);
    res.status(500).json({ success: false, error: "Eroare la adăugarea documentului" });
  }
});

export { router as claimRoutes };

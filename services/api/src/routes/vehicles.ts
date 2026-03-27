import { Router, Request, Response } from "express";
import { prisma } from "@autoerebus/database";
import { Prisma } from "@prisma/client";

const router = Router();

// GET / - List vehicles with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      brand,
      status,
      fuelType,
      condition,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      search,
      featured,
      page = "1",
      pageSize = "20",
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Math.min(Number(pageSize), 100);

    const where: Prisma.VehicleWhereInput = {};

    if (brand) where.brand = brand as any;
    if (status) where.status = status as any;
    if (fuelType) where.fuelType = fuelType as any;
    if (condition) where.condition = condition as any;
    if (featured === "true") where.featured = true;

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    if (minYear || maxYear) {
      where.year = {};
      if (minYear) where.year.gte = Number(minYear);
      if (maxYear) where.year.lte = Number(maxYear);
    }

    if (search) {
      const searchStr = String(search);
      where.OR = [
        { vin: { contains: searchStr, mode: "insensitive" } },
        { color: { contains: searchStr, mode: "insensitive" } },
        { description: { contains: searchStr, mode: "insensitive" } },
        { make: { name: { contains: searchStr, mode: "insensitive" } } },
        { model: { name: { contains: searchStr, mode: "insensitive" } } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          make: { select: { name: true, logo: true } },
          model: { select: { name: true } },
          images: { orderBy: { order: "asc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.vehicle.count({ where }),
    ]);

    res.json({
      success: true,
      data: vehicles,
      pagination: {
        page: Number(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("List vehicles error:", error);
    res.status(500).json({ success: false, error: "Eroare la listarea vehiculelor" });
  }
});

// GET /:id - Single vehicle with images
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: {
        make: true,
        model: true,
        images: { orderBy: { order: "asc" } },
        leads: {
          include: { customer: { select: { firstName: true, lastName: true } } },
          take: 5,
          orderBy: { createdAt: "desc" },
        },
        testDrives: {
          include: { customer: { select: { firstName: true, lastName: true } } },
          take: 5,
          orderBy: { scheduledAt: "desc" },
        },
      },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, error: "Vehiculul nu a fost găsit" });
      return;
    }

    res.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Get vehicle error:", error);
    res.status(500).json({ success: false, error: "Eroare la obținerea vehiculului" });
  }
});

// POST / - Create vehicle
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      vin, makeId, modelId, year, mileage, fuelType, transmission,
      bodyType, drivetrain, engineSize, horsepower, emissions,
      color, interiorColor, doors, seats, price, currency,
      condition, status, brand, description, features,
      registrationDate, previousOwners, featured,
    } = req.body;

    if (!makeId || !modelId || !year || !fuelType || !transmission || !price || !brand) {
      res.status(400).json({
        success: false,
        error: "Câmpurile obligatorii lipsesc: makeId, modelId, year, fuelType, transmission, price, brand",
      });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vin: vin || null,
        makeId,
        modelId,
        year: Number(year),
        mileage: mileage ? Number(mileage) : 0,
        fuelType,
        transmission,
        bodyType: bodyType || null,
        drivetrain: drivetrain || null,
        engineSize: engineSize ? Number(engineSize) : null,
        horsepower: horsepower ? Number(horsepower) : null,
        emissions: emissions ? Number(emissions) : null,
        color: color || null,
        interiorColor: interiorColor || null,
        doors: doors ? Number(doors) : null,
        seats: seats ? Number(seats) : null,
        price: Number(price),
        currency: currency || "EUR",
        condition: condition || "USED",
        status: status || "AVAILABLE",
        brand,
        description: description || null,
        features: features || [],
        registrationDate: registrationDate ? new Date(registrationDate) : null,
        previousOwners: previousOwners ? Number(previousOwners) : null,
        featured: featured || false,
      },
      include: { make: true, model: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Vehicle",
        entityId: vehicle.id,
        userId: req.user!.id,
        details: { vin: vehicle.vin, brand: vehicle.brand },
      },
    });

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Create vehicle error:", error);
    if ((error as any).code === "P2002") {
      res.status(409).json({ success: false, error: "Un vehicul cu acest VIN există deja" });
      return;
    }
    res.status(500).json({ success: false, error: "Eroare la crearea vehiculului" });
  }
});

// PATCH /:id - Update vehicle
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Vehiculul nu a fost găsit" });
      return;
    }

    const {
      vin, makeId, modelId, year, mileage, fuelType, transmission,
      bodyType, drivetrain, engineSize, horsepower, emissions,
      color, interiorColor, doors, seats, price, currency,
      condition, status, brand, description, features,
      registrationDate, previousOwners, featured,
    } = req.body;

    const data: Prisma.VehicleUpdateInput = {};

    if (vin !== undefined) data.vin = vin || null;
    if (makeId !== undefined) data.make = { connect: { id: makeId } };
    if (modelId !== undefined) data.model = { connect: { id: modelId } };
    if (year !== undefined) data.year = Number(year);
    if (mileage !== undefined) data.mileage = Number(mileage);
    if (fuelType !== undefined) data.fuelType = fuelType;
    if (transmission !== undefined) data.transmission = transmission;
    if (bodyType !== undefined) data.bodyType = bodyType;
    if (drivetrain !== undefined) data.drivetrain = drivetrain;
    if (engineSize !== undefined) data.engineSize = engineSize ? Number(engineSize) : null;
    if (horsepower !== undefined) data.horsepower = horsepower ? Number(horsepower) : null;
    if (emissions !== undefined) data.emissions = emissions ? Number(emissions) : null;
    if (color !== undefined) data.color = color;
    if (interiorColor !== undefined) data.interiorColor = interiorColor;
    if (doors !== undefined) data.doors = doors ? Number(doors) : null;
    if (seats !== undefined) data.seats = seats ? Number(seats) : null;
    if (price !== undefined) data.price = Number(price);
    if (currency !== undefined) data.currency = currency;
    if (condition !== undefined) data.condition = condition;
    if (status !== undefined) data.status = status;
    if (brand !== undefined) data.brand = brand;
    if (description !== undefined) data.description = description;
    if (features !== undefined) data.features = features;
    if (registrationDate !== undefined) data.registrationDate = registrationDate ? new Date(registrationDate) : null;
    if (previousOwners !== undefined) data.previousOwners = previousOwners ? Number(previousOwners) : null;
    if (featured !== undefined) data.featured = featured;

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data,
      include: { make: true, model: true, images: { orderBy: { order: "asc" } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Vehicle",
        entityId: vehicle.id,
        userId: req.user!.id,
        details: { updatedFields: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("Update vehicle error:", error);
    if ((error as any).code === "P2002") {
      res.status(409).json({ success: false, error: "Un vehicul cu acest VIN există deja" });
      return;
    }
    res.status(500).json({ success: false, error: "Eroare la actualizarea vehiculului" });
  }
});

// DELETE /:id - Delete vehicle + cascade images
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Vehiculul nu a fost găsit" });
      return;
    }

    // Delete images first (cascade is set in schema, but explicit for clarity)
    await prisma.vehicleImage.deleteMany({ where: { vehicleId: req.params.id } });
    await prisma.vehicle.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Vehicle",
        entityId: req.params.id,
        userId: req.user!.id,
        details: { vin: existing.vin, brand: existing.brand },
      },
    });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    res.status(500).json({ success: false, error: "Eroare la ștergerea vehiculului" });
  }
});

// POST /import-csv - Placeholder for CSV import
router.post("/import-csv", async (_req: Request, res: Response) => {
  // TODO: Implement CSV parsing and bulk vehicle creation
  res.status(501).json({
    success: false,
    error: "Import CSV nu este încă implementat",
  });
});

export { router as vehicleRoutes };

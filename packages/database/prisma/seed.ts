import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Create Makes ───────────────────────────────────
  const nissan = await prisma.make.upsert({
    where: { slug: "nissan" },
    update: {},
    create: { name: "Nissan", slug: "nissan", order: 1 },
  });

  const renault = await prisma.make.upsert({
    where: { slug: "renault" },
    update: {},
    create: { name: "Renault", slug: "renault", order: 2 },
  });

  const dacia = await prisma.make.upsert({
    where: { slug: "dacia" },
    update: {},
    create: { name: "Dacia", slug: "dacia", order: 3 },
  });

  const volkswagen = await prisma.make.upsert({
    where: { slug: "volkswagen" },
    update: {},
    create: { name: "Volkswagen", slug: "volkswagen", order: 4 },
  });

  const bmw = await prisma.make.upsert({
    where: { slug: "bmw" },
    update: {},
    create: { name: "BMW", slug: "bmw", order: 5 },
  });

  // ─── Create Models ─────────────────────────────────
  const models = [
    { name: "Qashqai", slug: "qashqai", makeId: nissan.id },
    { name: "Juke", slug: "juke", makeId: nissan.id },
    { name: "X-Trail", slug: "x-trail", makeId: nissan.id },
    { name: "Leaf", slug: "leaf", makeId: nissan.id },
    { name: "Ariya", slug: "ariya", makeId: nissan.id },
    { name: "Micra", slug: "micra", makeId: nissan.id },
    { name: "Clio", slug: "clio", makeId: renault.id },
    { name: "Captur", slug: "captur", makeId: renault.id },
    { name: "Megane", slug: "megane", makeId: renault.id },
    { name: "Austral", slug: "austral", makeId: renault.id },
    { name: "Arkana", slug: "arkana", makeId: renault.id },
    { name: "Espace", slug: "espace", makeId: renault.id },
    { name: "Duster", slug: "duster", makeId: dacia.id },
    { name: "Sandero", slug: "sandero", makeId: dacia.id },
    { name: "Logan", slug: "logan", makeId: dacia.id },
    { name: "Golf", slug: "golf", makeId: volkswagen.id },
    { name: "Tiguan", slug: "tiguan", makeId: volkswagen.id },
    { name: "Seria 3", slug: "seria-3", makeId: bmw.id },
    { name: "X1", slug: "x1", makeId: bmw.id },
  ];

  for (const model of models) {
    await prisma.vehicleModel.upsert({
      where: { makeId_slug: { makeId: model.makeId, slug: model.slug } },
      update: {},
      create: model,
    });
  }

  // ─── Create Super Admin ─────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@autoerebus.ro" },
    update: {},
    create: {
      email: "admin@autoerebus.ro",
      passwordHash: adminPassword,
      firstName: "Admin",
      lastName: "Autoerebus",
      role: "SUPER_ADMIN",
      brands: ["NISSAN", "RENAULT", "AUTORULATE", "SERVICE"],
      permissions: [],
    },
  });

  // ─── Create Demo Users ──────────────────────────────
  const agentPassword = await bcrypt.hash("agent123", 12);

  await prisma.user.upsert({
    where: { email: "agent.nissan@autoerebus.ro" },
    update: {},
    create: {
      email: "agent.nissan@autoerebus.ro",
      passwordHash: agentPassword,
      firstName: "Andrei",
      lastName: "Popescu",
      phone: "+40722000001",
      role: "AGENT",
      brands: ["NISSAN"],
      permissions: [
        "dashboard",
        "inventory.view",
        "sales.view",
        "sales.create",
        "sales.edit",
        "testdrive.view",
        "testdrive.create",
        "customers.view",
        "customers.create",
      ],
    },
  });

  await prisma.user.upsert({
    where: { email: "agent.renault@autoerebus.ro" },
    update: {},
    create: {
      email: "agent.renault@autoerebus.ro",
      passwordHash: agentPassword,
      firstName: "Maria",
      lastName: "Ionescu",
      phone: "+40722000002",
      role: "AGENT",
      brands: ["RENAULT"],
      permissions: [
        "dashboard",
        "inventory.view",
        "sales.view",
        "sales.create",
        "sales.edit",
        "testdrive.view",
        "testdrive.create",
        "customers.view",
        "customers.create",
      ],
    },
  });

  await prisma.user.upsert({
    where: { email: "receptie@autoerebus.ro" },
    update: {},
    create: {
      email: "receptie@autoerebus.ro",
      passwordHash: agentPassword,
      firstName: "Elena",
      lastName: "Vasile",
      phone: "+40722000003",
      role: "RECEPTION",
      brands: ["SERVICE"],
      permissions: [
        "dashboard",
        "service.view",
        "service.create",
        "service.edit",
        "claims.view",
        "claims.create",
        "customers.view",
        "customers.create",
      ],
    },
  });

  // ─── Create Pipeline Stages ─────────────────────────

  // Sales pipeline stages (per brand)
  const salesStages = [
    { name: "Lead Nou", order: 0, color: "#3B82F6" },
    { name: "Contactat", order: 1, color: "#8B5CF6" },
    { name: "Calificat", order: 2, color: "#F59E0B" },
    { name: "Ofertă Trimisă", order: 3, color: "#F97316" },
    { name: "Negociere", order: 4, color: "#EF4444" },
    { name: "Câștigat", order: 5, color: "#10B981", isDefault: false },
    { name: "Pierdut", order: 6, color: "#6B7280", isDefault: false },
  ];

  for (const brand of ["NISSAN", "RENAULT", "AUTORULATE"] as const) {
    for (const stage of salesStages) {
      await prisma.pipelineStage.upsert({
        where: {
          name_brand_pipelineType: {
            name: stage.name,
            brand,
            pipelineType: "SALES",
          },
        },
        update: {},
        create: {
          ...stage,
          brand,
          pipelineType: "SALES",
          isDefault: stage.order === 0,
        },
      });
    }
  }

  // Service pipeline stages
  const serviceStages = [
    { name: "Programat", order: 0, color: "#3B82F6" },
    { name: "Recepționat", order: 1, color: "#8B5CF6" },
    { name: "În Lucru", order: 2, color: "#F59E0B" },
    { name: "Așteptare Piese", order: 3, color: "#F97316" },
    { name: "Finalizat", order: 4, color: "#10B981" },
    { name: "Livrat", order: 5, color: "#6B7280" },
  ];

  for (const stage of serviceStages) {
    await prisma.pipelineStage.upsert({
      where: {
        name_brand_pipelineType: {
          name: stage.name,
          brand: "SERVICE",
          pipelineType: "SERVICE",
        },
      },
      update: {},
      create: {
        ...stage,
        brand: "SERVICE",
        pipelineType: "SERVICE",
        isDefault: stage.order === 0,
      },
    });
  }

  // Claims pipeline stages
  const claimStages = [
    { name: "Deschis", order: 0, color: "#3B82F6" },
    { name: "Documente Necesare", order: 1, color: "#8B5CF6" },
    { name: "În Analiză", order: 2, color: "#F59E0B" },
    { name: "Aprobat", order: 3, color: "#10B981" },
    { name: "În Reparație", order: 4, color: "#F97316" },
    { name: "Finalizat", order: 5, color: "#22C55E" },
    { name: "Respins", order: 6, color: "#EF4444" },
  ];

  for (const stage of claimStages) {
    await prisma.pipelineStage.upsert({
      where: {
        name_brand_pipelineType: {
          name: stage.name,
          brand: "SERVICE",
          pipelineType: "CLAIMS",
        },
      },
      update: {},
      create: {
        ...stage,
        brand: "SERVICE",
        pipelineType: "CLAIMS",
        isDefault: stage.order === 0,
      },
    });
  }

  // ─── Create Demo Vehicles ──────────────────────────
  const qashqai = await prisma.vehicleModel.findFirst({
    where: { slug: "qashqai" },
  });
  const clio = await prisma.vehicleModel.findFirst({
    where: { slug: "clio" },
  });
  const duster = await prisma.vehicleModel.findFirst({
    where: { slug: "duster" },
  });

  if (qashqai) {
    await prisma.vehicle.create({
      data: {
        makeId: nissan.id,
        modelId: qashqai.id,
        year: 2025,
        mileage: 0,
        fuelType: "HYBRID",
        transmission: "AUTOMATA",
        bodyType: "SUV",
        engineSize: 1.5,
        horsepower: 190,
        color: "Negru Metalic",
        doors: 5,
        seats: 5,
        price: 35900,
        condition: "NEW",
        status: "AVAILABLE",
        brand: "NISSAN",
        description: "Nissan Qashqai e-POWER Tekna+ 2025, full option",
        features: [
          "ProPILOT",
          "Camera 360",
          "Head-Up Display",
          "Încălzire scaune",
          "Navigație",
        ],
        featured: true,
      },
    });
  }

  if (clio) {
    await prisma.vehicle.create({
      data: {
        makeId: renault.id,
        modelId: clio.id,
        year: 2025,
        mileage: 0,
        fuelType: "HYBRID",
        transmission: "AUTOMATA",
        bodyType: "Hatchback",
        engineSize: 1.6,
        horsepower: 145,
        color: "Alb Glacier",
        doors: 5,
        seats: 5,
        price: 22500,
        condition: "NEW",
        status: "AVAILABLE",
        brand: "RENAULT",
        description: "Renault Clio E-Tech Hybrid Techno 2025",
        features: [
          "Ecran multimedia 9.3 inch",
          "Cameră marsarier",
          "Climatronic",
          "Senzori parcare",
        ],
        featured: true,
      },
    });
  }

  if (duster) {
    await prisma.vehicle.create({
      data: {
        makeId: dacia.id,
        modelId: duster.id,
        year: 2022,
        mileage: 45000,
        fuelType: "DIESEL",
        transmission: "MANUALA",
        bodyType: "SUV",
        engineSize: 1.5,
        horsepower: 115,
        color: "Gri Comete",
        doors: 5,
        seats: 5,
        price: 16500,
        condition: "USED",
        status: "AVAILABLE",
        brand: "AUTORULATE",
        description: "Dacia Duster Prestige 2022, stare excelentă",
        features: [
          "Navigație",
          "Cameră marsarier",
          "Climatronic",
          "Bare transversale",
        ],
        previousOwners: 1,
        registrationDate: new Date("2022-03-15"),
      },
    });
  }

  // ─── Create Demo Customer ──────────────────────────
  const customer = await prisma.customer.create({
    data: {
      firstName: "Ion",
      lastName: "Gheorghe",
      email: "ion.gheorghe@example.com",
      phone: "+40733000001",
      type: "INDIVIDUAL",
      source: "WEBSITE_NISSAN",
      gdprConsent: true,
      gdprDate: new Date(),
      city: "București",
      county: "Ilfov",
    },
  });

  // ─── Create Demo Lead ──────────────────────────────
  const agent = await prisma.user.findFirst({
    where: { email: "agent.nissan@autoerebus.ro" },
  });
  const vehicle = await prisma.vehicle.findFirst({
    where: { brand: "NISSAN" },
  });

  if (agent && vehicle) {
    await prisma.lead.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicle.id,
        source: "WEBSITE_NISSAN",
        brand: "NISSAN",
        status: "CONTACTED",
        assignedToId: agent.id,
        notes: "Clientul este interesat de Qashqai e-POWER, programat test drive.",
      },
    });
  }

  // ─── Site Settings ─────────────────────────────────
  const settings = [
    {
      key: "company_name",
      value: JSON.stringify("Autoerebus"),
      brand: null,
    },
    {
      key: "company_phone",
      value: JSON.stringify("+40212345678"),
      brand: null,
    },
    {
      key: "company_email",
      value: JSON.stringify("contact@autoerebus.ro"),
      brand: null,
    },
    {
      key: "company_address",
      value: JSON.stringify("Str. Exemplu nr. 1, București"),
      brand: null,
    },
  ];

  for (const setting of settings) {
    await prisma.siteSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
        brand: setting.brand as any,
      },
    });
  }

  // ─── Equipment: Electric Vehicle items ──────────────
  // Required for Autovit publishing of electric/PHEV vehicles.
  // Other equipment categories are populated via POST /api/equipment.
  const evCategory = await prisma.equipmentCategory.upsert({
    where: { autovitKey: "ev_specs" },
    update: { name: "Specificații vehicul electric" },
    create: { name: "Specificații vehicul electric", autovitKey: "ev_specs", order: 100 },
  });

  const evItems = [
    { name: "Functie incarcare rapida", autovitKey: "quick_charging_function" },
    { name: "Cablu incarcare masina electrica", autovitKey: "vehicle_charging_cable" },
    { name: "Sistem recuperare energie", autovitKey: "energy_recovery_system" },
  ];

  for (let i = 0; i < evItems.length; i++) {
    const item = evItems[i];
    await prisma.equipmentItem.upsert({
      where: { autovitKey: item.autovitKey },
      update: { name: item.name, categoryId: evCategory.id, order: i },
      create: { name: item.name, autovitKey: item.autovitKey, categoryId: evCategory.id, order: i },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

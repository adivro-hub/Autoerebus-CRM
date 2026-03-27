import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function toBool(val: string): boolean {
  return val === "Da" || val === "true" || val === "1";
}

function toFloatOrNull(val: string): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toIntOrNull(val: string): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Fisier CSV lipseste" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "Fisierul CSV este gol" }, { status: 400 });
    }

    const headers = parseCsvLine(lines[0]);
    const colIndex = (name: string) => headers.indexOf(name);

    // Validate required columns
    const required = ["Marca", "Model", "An", "Pret", "Combustibil", "Transmisie", "Brand"];
    const missing = required.filter((r) => colIndex(r) === -1);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Coloane lipsa: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Cache makes and models
    const allMakes = await prisma.make.findMany({
      include: { models: true },
    });

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length < 5) continue;

      const get = (col: string) => {
        const idx = colIndex(col);
        return idx >= 0 ? values[idx] ?? "" : "";
      };

      const makeName = get("Marca");
      const modelName = get("Model");

      // Find or create make
      let make = allMakes.find(
        (m) => m.name.toLowerCase() === makeName.toLowerCase()
      );
      if (!make) {
        const slug = makeName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        try {
          const created = await prisma.make.create({
            data: { name: makeName, slug },
            include: { models: true },
          });
          make = created;
          allMakes.push(created);
        } catch {
          errors.push(`Rand ${i + 1}: Nu s-a putut crea marca "${makeName}"`);
          continue;
        }
      }

      // Find or create model
      let model = make.models.find(
        (m) => m.name.toLowerCase() === modelName.toLowerCase()
      );
      if (!model) {
        const slug = modelName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        try {
          model = await prisma.vehicleModel.create({
            data: { name: modelName, slug, makeId: make.id },
          });
          make.models.push(model);
        } catch {
          errors.push(`Rand ${i + 1}: Nu s-a putut crea modelul "${modelName}"`);
          continue;
        }
      }

      const vehicleData = {
        title: get("Titlu") || null,
        makeId: make.id,
        modelId: model.id,
        year: parseInt(get("An"), 10),
        vin: get("VIN") || null,
        brand: (get("Brand") || "AUTORULATE") as any,
        condition: (get("Stare") || "USED") as any,
        status: (get("Disponibilitate") || "IN_STOCK") as any,
        fuelType: (get("Combustibil") || "BENZINA") as any,
        transmission: (get("Transmisie") || "MANUALA") as any,
        bodyType: get("Tip Caroserie") || null,
        drivetrain: get("Tractiune") || null,
        mileage: parseInt(get("Kilometraj"), 10) || 0,
        horsepower: toIntOrNull(get("Putere CP")),
        engineSize: toFloatOrNull(get("Cilindree cm3")),
        emissions: toIntOrNull(get("Emisii CO2")),
        batteryCapacity: toFloatOrNull(get("Capacitate Baterie kWh")),
        wltpRange: toIntOrNull(get("Autonomie WLTP km")),
        color: get("Culoare") || null,
        interiorColor: get("Interior") || null,
        doors: toIntOrNull(get("Usi")),
        seats: toIntOrNull(get("Locuri")),
        price: parseFloat(get("Pret")) || 0,
        discountPrice: toFloatOrNull(get("Pret Promotional")),
        currency: get("Moneda") || "EUR",
        vatDeductible: toBool(get("TVA Deductibil")),
        availableFinancing: toBool(get("Finantare Disponibila")),
        availableTestDrive: toBool(get("Test Drive Disponibil")),
        specialBadge: toBool(get("Badge Special")),
        specialBadgeText: get("Text Badge") || null,
        featured: toBool(get("Featured")),
        previousOwners: toIntOrNull(get("Proprietari Anteriori")),
        registrationDate: get("Data Inmatriculare")
          ? new Date(get("Data Inmatriculare"))
          : null,
        description: get("Descriere") || null,
      };

      try {
        const existingId = get("ID");
        if (existingId) {
          // Update existing
          const exists = await prisma.vehicle.findUnique({
            where: { id: existingId },
          });
          if (exists) {
            await prisma.vehicle.update({
              where: { id: existingId },
              data: vehicleData,
            });
            updated++;
            continue;
          }
        }

        // Check VIN duplicate
        if (vehicleData.vin) {
          const vinExists = await prisma.vehicle.findUnique({
            where: { vin: vehicleData.vin },
          });
          if (vinExists) {
            await prisma.vehicle.update({
              where: { vin: vehicleData.vin },
              data: vehicleData,
            });
            updated++;
            continue;
          }
        }

        // Create new
        await prisma.vehicle.create({ data: vehicleData });
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Rand ${i + 1} (${makeName} ${modelName}): ${msg.substring(0, 80)}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: lines.length - 1,
        imported,
        updated,
        errors: errors.slice(0, 20),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Import error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

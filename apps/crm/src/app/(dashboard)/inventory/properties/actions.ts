"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@autoerebus/database";
import { z } from "zod";

const VALID_CATEGORIES = [
  "availability",
  "condition",
  "bodyType",
  "fuelType",
  "transmission",
  "drivetrain",
  "color",
  "interiorColor",
  "features",
] as const;

const propertySchema = z.object({
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: "Categoria este invalida" }),
  }),
  value: z.string().min(1, "Valoarea este obligatorie").max(100),
  label: z.string().min(1, "Eticheta este obligatorie").max(100),
  order: z.coerce.number().int().min(0).default(0),
  active: z.coerce.boolean().default(true),
});

export async function createProperty(formData: FormData) {
  const parsed = propertySchema.safeParse({
    category: formData.get("category"),
    value: formData.get("value"),
    label: formData.get("label"),
    order: formData.get("order"),
    active: formData.get("active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  try {
    await prisma.carPropertyOption.create({
      data: parsed.data,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        error: "O proprietate cu aceasta valoare exista deja in aceasta categorie",
      };
    }
    return { error: "Eroare la crearea proprietatii" };
  }

  revalidatePath("/inventory/properties");
  return { success: true };
}

export async function updateProperty(id: string, formData: FormData) {
  const parsed = propertySchema.safeParse({
    category: formData.get("category"),
    value: formData.get("value"),
    label: formData.get("label"),
    order: formData.get("order"),
    active: formData.get("active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  try {
    await prisma.carPropertyOption.update({
      where: { id },
      data: parsed.data,
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        error: "O proprietate cu aceasta valoare exista deja in aceasta categorie",
      };
    }
    return { error: "Eroare la actualizarea proprietatii" };
  }

  revalidatePath("/inventory/properties");
  return { success: true };
}

export async function deleteProperty(id: string) {
  try {
    await prisma.carPropertyOption.delete({ where: { id } });
  } catch {
    return { error: "Eroare la stergerea proprietatii" };
  }

  revalidatePath("/inventory/properties");
  return { success: true };
}

export async function togglePropertyActive(id: string, active: boolean) {
  try {
    await prisma.carPropertyOption.update({
      where: { id },
      data: { active },
    });
  } catch {
    return { error: "Eroare la actualizarea starii" };
  }

  revalidatePath("/inventory/properties");
  return { success: true };
}

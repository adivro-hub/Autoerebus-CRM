"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@autoerebus/database";
import { z } from "zod";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const modelSchema = z.object({
  makeId: z.string().min(1, "Marca este obligatorie"),
  name: z.string().min(1, "Numele este obligatoriu").max(100),
  slug: z.string().optional(),
});

export async function createModel(formData: FormData) {
  const parsed = modelSchema.safeParse({
    makeId: formData.get("makeId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  const { makeId, name } = parsed.data;
  const slug = parsed.data.slug || generateSlug(name);

  try {
    await prisma.vehicleModel.create({
      data: { makeId, name, slug },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: "Un model cu acest slug exista deja pentru aceasta marca" };
    }
    return { error: "Eroare la crearea modelului" };
  }

  revalidatePath("/inventory/models");
  return { success: true };
}

export async function updateModel(id: string, formData: FormData) {
  const parsed = modelSchema.safeParse({
    makeId: formData.get("makeId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  const { makeId, name } = parsed.data;
  const slug = parsed.data.slug || generateSlug(name);

  try {
    await prisma.vehicleModel.update({
      where: { id },
      data: { makeId, name, slug },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: "Un model cu acest slug exista deja pentru aceasta marca" };
    }
    return { error: "Eroare la actualizarea modelului" };
  }

  revalidatePath("/inventory/models");
  return { success: true };
}

export async function deleteModel(id: string) {
  try {
    const model = await prisma.vehicleModel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vehicles: true },
        },
      },
    });

    if (!model) {
      return { error: "Modelul nu a fost gasit" };
    }

    if (model._count.vehicles > 0) {
      return {
        error: `Modelul nu poate fi sters deoarece are ${model._count.vehicles} vehicule asociate`,
      };
    }

    await prisma.vehicleModel.delete({ where: { id } });
  } catch {
    return { error: "Eroare la stergerea modelului" };
  }

  revalidatePath("/inventory/models");
  return { success: true };
}

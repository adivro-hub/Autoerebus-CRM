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

const makeSchema = z.object({
  name: z.string().min(1, "Numele este obligatoriu").max(100),
  slug: z.string().optional(),
  logo: z.string().url("URL invalid").optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).default(0),
});

export async function createMake(formData: FormData) {
  const parsed = makeSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logo: formData.get("logo"),
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  const { name, logo, order } = parsed.data;
  const slug = parsed.data.slug || generateSlug(name);

  try {
    await prisma.make.create({
      data: {
        name,
        slug,
        logo: logo || null,
        order,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: "O marca cu acest nume sau slug exista deja" };
    }
    return { error: "Eroare la crearea marcii" };
  }

  revalidatePath("/inventory/makes");
  return { success: true };
}

export async function updateMake(id: string, formData: FormData) {
  const parsed = makeSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logo: formData.get("logo"),
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Date invalide" };
  }

  const { name, logo, order } = parsed.data;
  const slug = parsed.data.slug || generateSlug(name);

  try {
    await prisma.make.update({
      where: { id },
      data: {
        name,
        slug,
        logo: logo || null,
        order,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: "O marca cu acest nume sau slug exista deja" };
    }
    return { error: "Eroare la actualizarea marcii" };
  }

  revalidatePath("/inventory/makes");
  return { success: true };
}

export async function deleteMake(id: string) {
  try {
    const make = await prisma.make.findUnique({
      where: { id },
      include: {
        _count: {
          select: { models: true, vehicles: true },
        },
      },
    });

    if (!make) {
      return { error: "Marca nu a fost gasita" };
    }

    if (make._count.models > 0 || make._count.vehicles > 0) {
      return {
        error: `Marca nu poate fi stearsa deoarece are ${make._count.models} modele si ${make._count.vehicles} vehicule asociate`,
      };
    }

    await prisma.make.delete({ where: { id } });
  } catch {
    return { error: "Eroare la stergerea marcii" };
  }

  revalidatePath("/inventory/makes");
  return { success: true };
}

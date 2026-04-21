import { notFound } from "next/navigation";
import { prisma } from "@autoerebus/database";
import OfferForm from "../offer-form";

export const dynamic = "force-dynamic";

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offer = await prisma.serviceOffer.findUnique({ where: { id } });
  if (!offer) return notFound();

  return (
    <OfferForm
      mode="edit"
      initial={{
        id: offer.id,
        title: offer.title,
        description: offer.description,
        brand: offer.brand,
        validityText: offer.validityText ?? "",
        order: offer.order,
        active: offer.active,
        ctaUrl: offer.ctaUrl ?? "",
        imageUrl: offer.imageUrl,
        imageCloudinaryId: offer.imageCloudinaryId ?? "",
      }}
    />
  );
}

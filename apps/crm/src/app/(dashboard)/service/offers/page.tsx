export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Button } from "@autoerebus/ui/components/button";
import { Badge } from "@autoerebus/ui/components/badge";
import { Plus, Pencil, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/auth";
import DeleteOfferButton from "./delete-button";

const BRAND_COLORS: Record<string, string> = {
  SERVICE: "bg-blue-100 text-blue-700",
  NISSAN: "bg-red-100 text-red-700",
  RENAULT: "bg-yellow-100 text-yellow-800",
  AUTORULATE: "bg-indigo-100 text-indigo-700",
  DAUNE: "bg-purple-100 text-purple-700",
};

export default async function ServiceOffersPage() {
  const session = await auth();
  if (!session?.user) return null;

  const offers = await prisma.serviceOffer.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: {
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Oferte Service</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ofertele afișate pe site-urile publice
          </p>
        </div>
        <Link href="/service/offers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ofertă nouă
          </Button>
        </Link>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">Nu există oferte încă.</p>
            <Link href="/service/offers/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Creează prima ofertă
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Imagine
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Titlu
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Brand
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Valabilitate
                  </th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider px-4 py-3">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={offer.imageUrl}
                        alt={offer.title}
                        className="w-16 h-12 object-cover rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{offer.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                        {offer.description}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          BRAND_COLORS[offer.brand] ||
                          "bg-gray-100 text-gray-700"
                        }
                      >
                        {offer.brand}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {offer.validityText || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {offer.active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <Eye className="h-3 w-3" />
                          Activă
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <EyeOff className="h-3 w-3" />
                          Ascunsă
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/service/offers/${offer.id}`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <DeleteOfferButton id={offer.id} title={offer.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

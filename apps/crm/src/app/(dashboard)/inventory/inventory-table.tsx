"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatCurrency } from "@autoerebus/ui/lib/utils";
import { FUEL_TYPE_LABELS } from "@autoerebus/types";
import { Pencil, Trash2, AlertTriangle, Loader2, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  IN_TRANSIT: { label: "In Tranzit", variant: "outline" },
  IN_STOCK: { label: "In Stoc", variant: "default" },
  RESERVED: { label: "Rezervat", variant: "secondary" },
  SOLD: { label: "Vandut", variant: "destructive" },
};

interface Vehicle {
  id: string;
  year: number;
  price: number;
  currency: string;
  discountPrice: number | null;
  status: string;
  fuelType: string;
  mileage: number;
  brand: string;
  vin: string | null;
  specialBadge: boolean;
  specialBadgeText: string | null;
  externalSlug: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  images?: { url: string }[];
  make: { name: string; slug: string };
  model: { name: string; slug: string };
  agent: { firstName: string; lastName: string } | null;
}

type SortColumn = "vehicle" | "brand" | "mileage" | "price" | "status" | "createdAt" | "updatedAt";
type SortDir = "asc" | "desc";

function getViewUrl(vehicle: Vehicle): string | null {
  switch (vehicle.brand) {
    case "AUTORULATE": {
      if (!vehicle.externalSlug) return null;
      return `https://rulate.autoerebus.ro/cumpara/${vehicle.externalSlug}`;
    }
    case "NISSAN":
    case "RENAULT":
    case "SERVICE":
      // For now, link to CRM detail page until sites are built
      return null;
    default:
      return null;
  }
}

interface InventoryTableProps {
  vehicles: Vehicle[];
}

export function InventoryTable({ vehicles }: InventoryTableProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortCol, setSortCol] = useState<SortColumn>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const deletingVehicle = vehicles.find((v) => v.id === deleteId);

  function toggleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const sortedVehicles = useMemo(() => {
    const arr = [...vehicles];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortCol) {
        case "vehicle":
          av = `${a.make.name} ${a.model.name} ${a.year}`;
          bv = `${b.make.name} ${b.model.name} ${b.year}`;
          break;
        case "brand":
          av = a.brand;
          bv = b.brand;
          break;
        case "mileage":
          av = a.mileage;
          bv = b.mileage;
          break;
        case "price":
          av = a.discountPrice || a.price;
          bv = b.discountPrice || b.price;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "createdAt":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          av = new Date(a.updatedAt).getTime();
          bv = new Date(b.updatedAt).getTime();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [vehicles, sortCol, sortDir]);

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortCol !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-gray-500" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3 text-gray-900" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3 text-gray-900" />
    );
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/vehicles/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Eroare");
      setDeleteId(null);
      router.refresh();
    } catch {
      alert("Eroare la stergerea vehiculului");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("vehicle")} className="flex items-center hover:text-gray-900">
                  Vehicul <SortIcon col="vehicle" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("brand")} className="flex items-center hover:text-gray-900">
                  Brand <SortIcon col="brand" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("mileage")} className="flex items-center hover:text-gray-900">
                  Km <SortIcon col="mileage" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("price")} className="flex items-center hover:text-gray-900">
                  Pret <SortIcon col="price" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("status")} className="flex items-center hover:text-gray-900">
                  Status <SortIcon col="status" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">Agent</th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("createdAt")} className="flex items-center hover:text-gray-900">
                  Adăugat <SortIcon col="createdAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button onClick={() => toggleSort("updatedAt")} className="flex items-center hover:text-gray-900">
                  Modificat <SortIcon col="updatedAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium">Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {sortedVehicles.map((vehicle) => {
              const statusInfo = STATUS_LABELS[vehicle.status] ?? {
                label: vehicle.status,
                variant: "outline" as const,
              };
              return (
                <tr
                  key={vehicle.id}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                  onClick={() => router.push(`/inventory/${vehicle.id}/edit`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {vehicle.images?.[0] ? (
                        <img
                          src={vehicle.images[0].url}
                          alt={`${vehicle.make.name} ${vehicle.model.name}`}
                          className="h-12 w-16 flex-shrink-0 rounded object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm text-gray-500">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {vehicle.make.name} {vehicle.model.name} ({vehicle.year})
                        </p>
                        {vehicle.specialBadge && vehicle.specialBadgeText && (
                          <Badge variant="destructive" className="mt-0.5 text-sm">
                            {vehicle.specialBadgeText}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{vehicle.brand}</td>
                  <td className="px-4 py-3">
                    {vehicle.mileage.toLocaleString("ro-RO")} km
                  </td>
                  <td className="px-4 py-3">
                    {vehicle.discountPrice ? (
                      <div>
                        <p className="text-sm text-gray-500 line-through">
                          {formatCurrency(vehicle.price, vehicle.currency)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-red-600">
                            {formatCurrency(vehicle.discountPrice, vehicle.currency)}
                          </p>
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-sm font-semibold text-red-700">
                            PROMO
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">
                        {formatCurrency(vehicle.price, vehicle.currency)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {vehicle.agent
                      ? `${vehicle.agent.firstName} ${vehicle.agent.lastName}`
                      : "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap"
                    title={new Date(vehicle.createdAt).toLocaleString("ro-RO")}
                  >
                    {new Date(vehicle.createdAt).toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap"
                    title={new Date(vehicle.updatedAt).toLocaleString("ro-RO")}
                  >
                    {new Date(vehicle.updatedAt).toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const viewUrl = getViewUrl(vehicle);
                        return viewUrl ? (
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            title="Vezi pe site"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null;
                      })()}
                      <Link
                        href={`/inventory/${vehicle.id}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-gray-500 hover:bg-accent hover:text-foreground"
                        title="Editeaza"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => setDeleteId(vehicle.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        title="Sterge"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Stergere vehicul</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Esti sigur ca vrei sa stergi{" "}
                  <span className="font-medium text-foreground">
                    {deletingVehicle
                      ? `${deletingVehicle.make.name} ${deletingVehicle.model.name} (${deletingVehicle.year})`
                      : "acest vehicul"}
                  </span>
                  ?
                </p>
                <p className="mt-2 text-sm font-medium text-red-600">
                  Atentie: Vehiculul va fi sters definitiv din CRM
                  {deletingVehicle?.brand === "AUTORULATE" &&
                    " si va disparea si din site-ul Autorulate (Second Hand)"}
                  {deletingVehicle?.brand === "NISSAN" &&
                    " si va disparea si din site-ul Nissan"}
                  {deletingVehicle?.brand === "RENAULT" &&
                    " si va disparea si din site-ul Renault"}
                  {deletingVehicle?.brand === "SERVICE" &&
                    " si va disparea si din site-ul Service"}
                  .
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
              >
                Anuleaza
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Se sterge..." : "Da, sterge definitiv"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

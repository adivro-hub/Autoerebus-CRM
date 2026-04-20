"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS, BRAND_LABELS } from "@autoerebus/types";
import { ArrowLeft, Save } from "lucide-react";
import { ImageUploader, type UploadedImage } from "@/components/image-uploader";

const CONDITION_OPTIONS = [
  { value: "NEW", label: "Nou" },
  { value: "USED", label: "Second-hand" },
  { value: "DEMO", label: "Demo" },
];

const STATUS_OPTIONS = [
  { value: "IN_TRANSIT", label: "In Tranzit" },
  { value: "IN_STOCK", label: "In Stoc" },
  { value: "RESERVED", label: "Rezervat" },
  { value: "SOLD", label: "Vandut" },
];

interface MakeOption {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface PropertyOption {
  id: string;
  category: string;
  value: string;
  label: string;
}

export default function NewVehiclePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  const userBrands = ((session?.user as { brands?: string[] })?.brands as string[]) || [];
  const isRestricted = userRole !== "SUPER_ADMIN" && userBrands.length > 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState("");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [bodyTypes, setBodyTypes] = useState<PropertyOption[]>([]);
  const [conditions, setConditions] = useState<PropertyOption[]>([]);
  const [specialBadge, setSpecialBadge] = useState(false);
  const [fuelType, setFuelType] = useState("BENZINA");

  useEffect(() => {
    Promise.all([
      fetch("/api/makes").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/properties?category=bodyType").then((r) => r.json()),
      fetch("/api/properties?category=condition").then((r) => r.json()),
    ]).then(([makesData, usersData, bodyData, conditionData]) => {
      if (makesData.success) setMakes(makesData.data);
      if (usersData.success) setUsers(usersData.data);
      if (bodyData.success) setBodyTypes(bodyData.data);
      if (conditionData.success) setConditions(conditionData.data);
    });
  }, []);

  useEffect(() => {
    const make = makes.find((m) => m.id === selectedMakeId);
    setModels(make?.models ?? []);
  }, [selectedMakeId, makes]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          year: parseInt(data.year as string, 10),
          mileage: parseInt(data.mileage as string, 10) || 0,
          price: parseFloat(data.price as string),
          discountPrice: data.discountPrice ? parseFloat(data.discountPrice as string) : null,
          horsepower: data.horsepower ? parseInt(data.horsepower as string, 10) : null,
          engineSize: data.engineSize ? parseFloat(data.engineSize as string) : null,
          doors: data.doors ? parseInt(data.doors as string, 10) : null,
          seats: data.seats ? parseInt(data.seats as string, 10) : null,
          emissions: data.emissions ? parseInt(data.emissions as string, 10) : null,
          batteryCapacity: data.batteryCapacity ? parseFloat(data.batteryCapacity as string) : null,
          wltpRange: data.wltpRange ? parseInt(data.wltpRange as string, 10) : null,
          vatDeductible: data.vatDeductible === "on",
          availableFinancing: data.availableFinancing === "on",
          availableTestDrive: data.availableTestDrive === "on",
          specialBadge: data.specialBadge === "on",
          specialBadgeText: data.specialBadgeText || null,
          agentId: data.agentId || null,
          images: images.map((img) => ({
            url: img.url,
            cloudinaryId: img.cloudinaryId,
            order: img.order,
          })),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Eroare la salvare");
      }

      const result = await response.json();
      router.push(`/inventory/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la salvare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-base font-bold">Vehicul Nou</h1>
          <p className="text-sm text-gray-500">
            Adaugati un vehicul nou in inventar
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informatii de Baza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <Input label="Titlu" name="title" placeholder="Ex: Nissan Qashqai e-POWER Tekna+ 2025" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Brand *</label>
                <select
                  name="brand"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza brand</option>
                  {Object.entries(BRAND_LABELS)
                    .filter(([key]) => key !== "SERVICE")
                    .filter(([key]) => !isRestricted || userBrands.includes(key))
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Marca *</label>
                <select
                  name="makeId"
                  required
                  value={selectedMakeId}
                  onChange={(e) => setSelectedMakeId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza marca</option>
                  {makes.map((make) => (
                    <option key={make.id} value={make.id}>{make.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Model *</label>
                <select
                  name="modelId"
                  required
                  disabled={!selectedMakeId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">
                    {selectedMakeId ? "Selecteaza model" : "Selecteaza marca intai"}
                  </option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
              <Input label="An *" name="year" type="number" min={1990} max={2030} required />
              <Input label="VIN" name="vin" placeholder="Ex: WVWZZZ3CZWE123456" />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Stare *</label>
                <select
                  name="condition"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {(conditions.length > 0 ? conditions : CONDITION_OPTIONS).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Disponibilitate *</label>
                <select
                  name="status"
                  defaultValue="IN_STOCK"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Agent Responsabil</label>
                <select
                  name="agentId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Fara agent</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="availableTestDrive"
                  className="h-4 w-4 rounded border-input"
                />
                Disponibil pentru Test Drive
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imagini</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploader images={images} onChange={setImages} />
          </CardContent>
        </Card>

        {/* Technical Specs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Specificatii Tehnice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tip Caroserie</label>
                <select
                  name="bodyType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza</option>
                  {bodyTypes.map((bt) => (
                    <option key={bt.id} value={bt.value}>{bt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Combustibil *</label>
                <select
                  name="fuelType"
                  required
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Transmisie *</label>
                <select
                  name="transmission"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <Input label="Kilometraj *" name="mileage" type="number" min={0} required />
              <Input label="Putere (CP)" name="horsepower" type="number" />
              {/* Cilindree - hidden for ELECTRIC */}
              {fuelType !== "ELECTRIC" && (
                <Input label="Cilindree (cm³)" name="engineSize" type="number" />
              )}
              {/* Battery + WLTP - shown for ELECTRIC and PHEV */}
              {(fuelType === "ELECTRIC" || fuelType === "PHEV") && (
                <>
                  <Input label="Capacitate Baterie (kWh)" name="batteryCapacity" type="number" step="0.1" />
                  <Input
                    label={fuelType === "PHEV" ? "Autonomie Electrica WLTP (km)" : "Autonomie WLTP (km)"}
                    name="wltpRange"
                    type="number"
                  />
                </>
              )}
              <Input label="Emisii CO2 (g/km)" name="emissions" type="number" />
              <Input label="Culoare" name="color" placeholder="Ex: Alb" />
              <Input label="Interior" name="interiorColor" placeholder="Ex: Negru" />
              <Input label="Usi" name="doors" type="number" min={2} max={5} />
              <Input label="Locuri" name="seats" type="number" min={2} max={9} />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pret</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="Pret *" name="price" type="number" step="0.01" min={0} required />
              <Input label="Pret Promotional" name="discountPrice" type="number" step="0.01" min={0} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Moneda</label>
                <select
                  name="currency"
                  defaultValue="EUR"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EUR">EUR</option>
                  <option value="RON">RON</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="vatDeductible"
                  className="h-4 w-4 rounded border-input"
                />
                TVA Deductibil
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="availableFinancing"
                  className="h-4 w-4 rounded border-input"
                />
                Disponibil pentru Finantare
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Special Badge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Badge Special</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="specialBadge"
                checked={specialBadge}
                onChange={(e) => setSpecialBadge(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Afiseaza badge special pe acest vehicul
            </label>
            {specialBadge && (
              <div className="mt-3">
                <Input
                  label="Text Badge"
                  name="specialBadgeText"
                  placeholder="Ex: Oferta Limitata, Pret Redus, Nou in Stoc"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descriere</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              name="description"
              rows={4}
              placeholder="Descriere vehicul..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/inventory">
            <Button variant="outline" type="button">
              Anuleaza
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            <Save className="h-4 w-4" />
            {loading ? "Se salveaza..." : "Salveaza Vehicul"}
          </Button>
        </div>
      </form>
    </div>
  );
}

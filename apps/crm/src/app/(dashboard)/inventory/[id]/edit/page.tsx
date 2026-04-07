"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS, BRAND_LABELS } from "@autoerebus/types";
import { ArrowLeft, Save, Loader2, CheckCircle2, Upload, ExternalLink, Trash2 } from "lucide-react";
import { ImageUploader, type UploadedImage } from "@/components/image-uploader";
import { useToast } from "@/components/toast-provider";

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

interface VehicleData {
  id: string;
  title: string | null;
  vin: string | null;
  makeId: string;
  modelId: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  bodyType: string | null;
  drivetrain: string | null;
  engineSize: number | null;
  horsepower: number | null;
  emissions: number | null;
  batteryCapacity: number | null;
  wltpRange: number | null;
  color: string | null;
  interiorColor: string | null;
  doors: number | null;
  seats: number | null;
  price: number;
  discountPrice: number | null;
  currency: string;
  vatDeductible: boolean;
  availableFinancing: boolean;
  condition: string;
  status: string;
  brand: string;
  description: string | null;
  features: string[];
  availableTestDrive: boolean;
  specialBadge: boolean;
  specialBadgeText: string | null;
  agentId: string | null;
  autovitId: string | null;
  autovitStatus: string | null;
  autovitSyncedAt: string | null;
  previousOwners: number | null;
  registrationDate: string | null;
  // Autovit extras
  generation: string | null;
  emissionStandard: string | null;
  fuelConsumptionUrban: number | null;
  fuelConsumptionExtraUrban: number | null;
  fuelConsumptionCombined: number | null;
  priceNegotiable: boolean;
  noAccidents: boolean;
  serviceRecord: boolean;
  images: { id: string; url: string; cloudinaryId: string | null; order: number }[];
}

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [bodyTypes, setBodyTypes] = useState<PropertyOption[]>([]);
  const [conditions, setConditions] = useState<PropertyOption[]>([]);
  const [fuelType, setFuelType] = useState("BENZINA");
  const [specialBadge, setSpecialBadge] = useState(false);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [badgeText, setBadgeText] = useState("");
  const [equipmentCategories, setEquipmentCategories] = useState<{ id: string; name: string; autovitKey: string; items: { id: string; name: string; autovitKey: string }[] }[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const toast = useToast();

  async function callAutovit(action: "publish" | "export-olx" | "activate" | "delete", confirmMsg: string, loadingLabel: string) {
    if (!vehicle) return;
    if (!confirm(confirmMsg)) return;
    setActionBusy(loadingLabel);
    setPublishing(true);
    try {
      const res = await fetch("/api/autovit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, vehicleIds: [vehicle.id] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Eroare Autovit", "Autovit");
        return;
      }
      const result = data.results?.[0];
      if (result?.success) {
        const stepsInfo = result.steps
          ? result.steps.map((s: { name: string; ok: boolean; info?: string }) => `${s.ok ? "✓" : "✗"} ${s.name}${s.info ? ` (${s.info})` : ""}`).join(" · ")
          : `ID ${result.autovitId}`;
        toast.success(stepsInfo, loadingLabel);
        const vRes = await fetch(`/api/vehicles/${id}`);
        const vData = await vRes.json();
        if (vData.success && vData.data) setVehicle(vData.data);
      } else {
        toast.error(result?.error || "Eroare necunoscută", "Autovit");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare de rețea", "Autovit");
    } finally {
      setPublishing(false);
      setActionBusy(null);
    }
  }

  function handlePublishAutovit() {
    const isUpdate = !!vehicle?.autovitId;
    return callAutovit(
      "publish",
      isUpdate ? "Actualizezi anunțul pe Autovit?" : "Publici această mașină ca anunț nou pe Autovit (draft)?",
      isUpdate ? "Anunț actualizat" : "Anunț publicat"
    );
  }

  function handleExportOlx() {
    return callAutovit(
      "export-olx",
      "Adaugi anunțul și pe OLX (gratuit)? Trebuie apoi să-l activezi.",
      "Export OLX"
    );
  }

  function handleActivateAutovit() {
    return callAutovit(
      "activate",
      "Activezi anunțul pe Autovit? (se aplică promoțiile din coadă, inclusiv OLX)",
      "Anunț activat"
    );
  }

  function handleDeleteAutovit() {
    return callAutovit(
      "delete",
      "ATENȚIE: Ștergi definitiv anunțul de pe Autovit? Această acțiune nu poate fi anulată.",
      "Anunț șters"
    );
  }

  // Load vehicle + reference data
  useEffect(() => {
    Promise.all([
      fetch(`/api/vehicles/${id}`).then((r) => r.json()),
      fetch("/api/makes").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/properties?category=bodyType").then((r) => r.json()),
      fetch("/api/properties?category=condition").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch(`/api/vehicles/${id}/equipment`).then((r) => r.json()),
    ]).then(([vehicleData, makesData, usersData, bodyData, conditionData, equipData, vehicleEquipData]) => {
      if (vehicleData.success && vehicleData.data) {
        const v = vehicleData.data;
        setVehicle(v);
        setSelectedMakeId(v.makeId);
        setSelectedModelId(v.modelId);
        setFuelType(v.fuelType);
        setSpecialBadge(v.specialBadge);
        setBadgeText(v.specialBadgeText || "");
        setImages(
          (v.images || []).map((img: any) => ({
            url: img.url,
            cloudinaryId: img.cloudinaryId || "",
            order: img.order,
          }))
        );
      }
      if (makesData.success) setMakes(makesData.data);
      if (usersData.success) setUsers(usersData.data);
      if (bodyData.success) setBodyTypes(bodyData.data);
      if (conditionData.success) setConditions(conditionData.data);
      if (equipData.success) setEquipmentCategories(equipData.data);
      if (vehicleEquipData.success) setSelectedEquipment(new Set(vehicleEquipData.data));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Update models when make changes
  useEffect(() => {
    const make = makes.find((m) => m.id === selectedMakeId);
    setModels(make?.models ?? []);
  }, [selectedMakeId, makes]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: "PATCH",
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
          previousOwners: data.previousOwners ? parseInt(data.previousOwners as string, 10) : null,
          registrationDate: data.registrationDate || null,
          generation: data.generation || null,
          emissionStandard: data.emissionStandard || null,
          fuelConsumptionUrban: data.fuelConsumptionUrban ? parseFloat(data.fuelConsumptionUrban as string) : null,
          fuelConsumptionExtraUrban: data.fuelConsumptionExtraUrban ? parseFloat(data.fuelConsumptionExtraUrban as string) : null,
          fuelConsumptionCombined: data.fuelConsumptionCombined ? parseFloat(data.fuelConsumptionCombined as string) : null,
          vatDeductible: data.vatDeductible === "on",
          availableFinancing: data.availableFinancing === "on",
          priceNegotiable: data.priceNegotiable === "on",
          noAccidents: data.noAccidents === "on",
          serviceRecord: data.serviceRecord === "on",
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

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="py-20 text-center text-gray-500">
        Vehiculul nu a fost gasit.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/inventory/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-base font-bold">Editeaza Vehicul</h1>
          <p className="text-sm text-gray-500">
            {vehicle.brand} - Modificati datele vehiculului
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" key={vehicle.id} id="edit-vehicle-form">
        {/* Operational */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operațional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Brand *</label>
                <select
                  name="brand"
                  required
                  defaultValue={vehicle.brand}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(BRAND_LABELS)
                    .filter(([key]) => key !== "SERVICE")
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Stare *</label>
                <select
                  name="condition"
                  required
                  defaultValue={vehicle.condition}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {conditions.length > 0
                    ? conditions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))
                    : CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Disponibilitate *</label>
                <select
                  name="status"
                  required
                  defaultValue={vehicle.status}
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
                  defaultValue={vehicle.agentId ?? ""}
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">&nbsp;</label>
                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      name="availableTestDrive"
                      defaultChecked={vehicle.availableTestDrive}
                      className="h-4 w-4 rounded border-input"
                    />
                    Test Drive
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">&nbsp;</label>
                <div className="flex items-center h-10 gap-2">
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={specialBadge}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBadgeModalOpen(true);
                        } else {
                          setSpecialBadge(false);
                          setBadgeText("");
                        }
                      }}
                      className="h-4 w-4 rounded border-input"
                    />
                    Badge Special
                  </label>
                  {specialBadge && badgeText && (
                    <button
                      type="button"
                      onClick={() => setBadgeModalOpen(true)}
                      className="text-sm text-gray-500 hover:text-gray-900 underline"
                    >
                      ({badgeText})
                    </button>
                  )}
                </div>
                {/* Hidden inputs for form submission */}
                <input type="hidden" name="specialBadge" value={specialBadge ? "on" : ""} />
                <input type="hidden" name="specialBadgeText" value={badgeText} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informații Vehicul</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-4">
                <Input label="Titlu" name="title" defaultValue={vehicle.title ?? ""} placeholder="Ex: Nissan Qashqai e-POWER Tekna+ 2025" />
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
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  disabled={!selectedMakeId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
              <Input label="An *" name="year" type="number" min={1990} max={2030} defaultValue={vehicle.year} required />
              <Input label="VIN" name="vin" defaultValue={vehicle.vin ?? ""} placeholder="Ex: WVWZZZ3CZWE123456" />
            </div>
          </CardContent>
        </Card>

        {/* Technical Specs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Specificatii Tehnice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tip Caroserie</label>
                <select
                  name="bodyType"
                  defaultValue={vehicle.bodyType ?? ""}
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
                  defaultValue={vehicle.transmission}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <Input label="Kilometraj *" name="mileage" type="number" min={0} defaultValue={vehicle.mileage} required />
              <Input label="Putere (CP)" name="horsepower" type="number" defaultValue={vehicle.horsepower ?? ""} />
              {fuelType !== "ELECTRIC" && (
                <Input label="Cilindree (cm³)" name="engineSize" type="number" defaultValue={vehicle.engineSize ?? ""} />
              )}
              {(fuelType === "ELECTRIC" || fuelType === "PHEV") && (
                <>
                  <Input label="Capacitate Baterie (kWh)" name="batteryCapacity" type="number" step="0.1" defaultValue={vehicle.batteryCapacity ?? ""} />
                  <Input
                    label={fuelType === "PHEV" ? "Autonomie Electrica WLTP (km)" : "Autonomie WLTP (km)"}
                    name="wltpRange"
                    type="number"
                    defaultValue={vehicle.wltpRange ?? ""}
                  />
                </>
              )}
              <Input label="Emisii CO2 (g/km)" name="emissions" type="number" defaultValue={vehicle.emissions ?? ""} />
              <Input label="Culoare" name="color" defaultValue={vehicle.color ?? ""} />
              <Input label="Interior" name="interiorColor" defaultValue={vehicle.interiorColor ?? ""} />
              <Input label="Usi" name="doors" type="number" min={2} max={5} defaultValue={vehicle.doors ?? ""} />
              <Input label="Locuri" name="seats" type="number" min={2} max={9} defaultValue={vehicle.seats ?? ""} />
              <Input
                label="Data primei inmatriculari"
                name="registrationDate"
                type="date"
                defaultValue={vehicle.registrationDate ? vehicle.registrationDate.slice(0, 10) : ""}
              />
              <Input
                label="Proprietari anteriori"
                name="previousOwners"
                type="number"
                min={0}
                defaultValue={vehicle.previousOwners ?? ""}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Norma poluare</label>
                <select
                  name="emissionStandard"
                  defaultValue={vehicle.emissionStandard ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza</option>
                  <option value="euro-1">Euro 1</option>
                  <option value="euro-2">Euro 2</option>
                  <option value="euro-3">Euro 3</option>
                  <option value="euro-4">Euro 4</option>
                  <option value="euro-5">Euro 5</option>
                  <option value="euro-6">Euro 6</option>
                  <option value="non-euro">Non-euro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Generatie</label>
                <div className="flex gap-2">
                  <input
                    name="generation"
                    defaultValue={vehicle.generation ?? ""}
                    placeholder="ex: gen-ii-2017"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const make = makes.find((m) => m.id === selectedMakeId);
                        const model = models.find((m) => m.id === selectedModelId);
                        const year = (document.querySelector('[name="year"]') as HTMLInputElement)?.value;
                        if (!make || !model || !year) {
                          alert("Selectează marcă, model și an");
                          return;
                        }
                        const makeSlug = make.name.toLowerCase().replace(/\s+/g, "-");
                        const modelSlug = model.name.toLowerCase().replace(/\s+/g, "-");
                        const res = await fetch(`/api/autovit/generation?make=${makeSlug}&model=${modelSlug}&year=${year}`);
                        const data = await res.json();
                        if (data.detected) {
                          const input = document.querySelector('[name="generation"]') as HTMLInputElement;
                          if (input) input.value = data.detected;
                          alert(`Generație detectată: ${data.detectedLabel}`);
                        } else {
                          alert("Nu s-a putut detecta generația automat");
                        }
                      } catch (e) {
                        alert("Eroare la detecție: " + (e instanceof Error ? e.message : "unknown"));
                      }
                    }}
                  >
                    Auto
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Consum urban (l/100km)"
                name="fuelConsumptionUrban"
                type="number"
                step="0.1"
                defaultValue={vehicle.fuelConsumptionUrban ?? ""}
              />
              <Input
                label="Consum extraurban (l/100km)"
                name="fuelConsumptionExtraUrban"
                type="number"
                step="0.1"
                defaultValue={vehicle.fuelConsumptionExtraUrban ?? ""}
              />
              <Input
                label="Consum combinat (l/100km)"
                name="fuelConsumptionCombined"
                type="number"
                step="0.1"
                defaultValue={vehicle.fuelConsumptionCombined ?? ""}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="noAccidents"
                  defaultChecked={vehicle.noAccidents}
                  className="h-4 w-4 rounded border-input"
                />
                Fara accidente
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="serviceRecord"
                  defaultChecked={vehicle.serviceRecord}
                  className="h-4 w-4 rounded border-input"
                />
                Carte de service
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pret</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Pret *" name="price" type="number" step="0.01" min={0} defaultValue={vehicle.price} required />
              <Input label="Pret Promotional" name="discountPrice" type="number" step="0.01" min={0} defaultValue={vehicle.discountPrice ?? ""} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Moneda</label>
                <select
                  name="currency"
                  defaultValue={vehicle.currency}
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
                  defaultChecked={vehicle.vatDeductible}
                  className="h-4 w-4 rounded border-input"
                />
                TVA Deductibil
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="availableFinancing"
                  defaultChecked={vehicle.availableFinancing}
                  className="h-4 w-4 rounded border-input"
                />
                Disponibil pentru Finantare
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="priceNegotiable"
                  defaultChecked={vehicle.priceNegotiable}
                  className="h-4 w-4 rounded border-input"
                />
                Pret negociabil
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

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descriere</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              name="description"
              rows={4}
              defaultValue={vehicle.description ?? ""}
              placeholder="Descriere vehicul..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>

        {/* Spacer for sticky bar */}
        <div className="h-20" />
      </form>

      {/* Equipment / Dotări — outside form since it saves independently */}
      {equipmentCategories.length > 0 && (
        <Card className="-mt-20 mb-24">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dotări / Echipamente</CardTitle>
              <Button
                type="button"
                size="sm"
                disabled={savingEquipment}
                onClick={async () => {
                  setSavingEquipment(true);
                  try {
                    await fetch(`/api/vehicles/${id}/equipment`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ itemIds: Array.from(selectedEquipment) }),
                    });
                    setSuccess(true);
                    setTimeout(() => setSuccess(false), 3000);
                  } catch { /* ignore */ }
                  finally { setSavingEquipment(false); }
                }}
              >
                {savingEquipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvează dotările
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {equipmentCategories.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{cat.name}</h4>
                    <button
                      type="button"
                      className="text-sm text-gray-500 hover:text-gray-900"
                      onClick={() => {
                        const allIds = cat.items.map((i) => i.id);
                        const allSelected = allIds.every((iid) => selectedEquipment.has(iid));
                        setSelectedEquipment((prev) => {
                          const next = new Set(prev);
                          if (allSelected) {
                            allIds.forEach((iid) => next.delete(iid));
                          } else {
                            allIds.forEach((iid) => next.add(iid));
                          }
                          return next;
                        });
                      }}
                    >
                      {cat.items.every((i) => selectedEquipment.has(i.id)) ? "Deselectează tot" : "Selectează tot"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {cat.items.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          selectedEquipment.has(item.id)
                            ? "border-gray-900 bg-gray-50 font-medium"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEquipment.has(item.id)}
                          onChange={() => {
                            setSelectedEquipment((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {item.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-end gap-3 px-6 py-3">
          {success && (
            <div className="mr-auto flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Salvat cu succes
            </div>
          )}
          {vehicle?.autovitId && (
            <div className="flex items-center gap-2">
              {(() => {
                const s = vehicle.autovitStatus;
                const cfg: Record<string, { label: string; cls: string }> = {
                  active: { label: "Activ", cls: "bg-green-100 text-green-700" },
                  unpaid: { label: "În așteptare", cls: "bg-amber-100 text-amber-700" },
                  deactivated: { label: "Dezactivat", cls: "bg-gray-200 text-gray-700" },
                };
                const style = s && cfg[s] ? cfg[s] : { label: s || "Necunoscut", cls: "bg-gray-100 text-gray-600" };
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${style.cls}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Autovit: {style.label}
                  </span>
                );
              })()}
              <a
                href={`https://www.autovit.ro/autoturisme/anunt/?ID=${vehicle.autovitId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-900 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                ID {vehicle.autovitId}
              </a>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handlePublishAutovit}
            disabled={publishing}
            title="Creează sau actualizează anunțul pe Autovit (fără activare)"
          >
            {publishing && actionBusy?.includes("Anunț") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {vehicle?.autovitId ? "Actualizează Autovit" : "Publică pe Autovit"}
          </Button>

          {vehicle?.autovitId && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportOlx}
                disabled={publishing}
                title="Adaugă anunțul și pe OLX.ro (gratuit). Funcționează doar pe anunțuri neactivate."
              >
                {publishing && actionBusy === "Export OLX" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Export OLX
              </Button>
              <Button
                type="button"
                onClick={handleActivateAutovit}
                disabled={publishing}
                title="Activează anunțul pe Autovit (aplică promoțiile din coadă, inclusiv OLX)"
              >
                {publishing && actionBusy === "Anunț activat" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Activează
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteAutovit}
                disabled={publishing}
                className="text-red-600 border-red-300 hover:bg-red-50"
                title="Șterge definitiv anunțul de pe Autovit"
              >
                {publishing && actionBusy === "Anunț șters" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Șterge Autovit
              </Button>
            </>
          )}
          <Link href={`/inventory/${id}`}>
            <Button variant="outline" type="button">
              Anuleaza
            </Button>
          </Link>
          <Button type="submit" disabled={saving} form="edit-vehicle-form">
            <Save className="h-4 w-4" />
            {saving ? "Se salveaza..." : "Salveaza Modificarile"}
          </Button>
        </div>
      </div>

      {/* Badge Special Modal */}
      {badgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { if (!specialBadge) setBadgeModalOpen(false); }}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">Badge Special</h3>
            <p className="text-sm text-gray-500">Introdu textul care va apărea ca badge pe acest vehicul.</p>
            <input
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="Ex: Oferta Limitata, Pret Redus"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSpecialBadge(false);
                  setBadgeText("");
                  setBadgeModalOpen(false);
                }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => {
                  if (badgeText.trim()) {
                    setSpecialBadge(true);
                    setBadgeModalOpen(false);
                  }
                }}
                disabled={!badgeText.trim()}
                className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                Activează badge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {success && (
        <div className="fixed right-6 top-20 z-50 animate-in slide-in-from-top-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">
              Modificarile au fost salvate cu succes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Button } from "@autoerebus/ui";
import { Input } from "@autoerebus/ui";
import { Search, Plus, X, Check } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface Config {
  regionId: number | null;
  regionName: string | null;
  cityId: number | null;
  cityName: string | null;
  districtsCityId: number | null;
  districtId: number | null;
  districtName: string | null;
  contactPerson: string;
  contactPhones: string[];
  latitude: number | null;
  longitude: number | null;
  advertiserType: "business" | "private";
  defaultDescriptionSuffix: string;
}

interface LocationResult {
  id: number;
  name: string;
  text?: string;
  regionId?: number;
  regionName?: string;
  districtsCityId?: number;
}

export default function AutovitSettingsClient({ initialConfig }: { initialConfig: Config }) {
  const toast = useToast();
  const [config, setConfig] = useState<Config>(initialConfig);
  const [saving, setSaving] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<LocationResult[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [districts, setDistricts] = useState<LocationResult[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Search cities on query change (debounced)
  useEffect(() => {
    if (cityQuery.length < 2) {
      setCityResults([]);
      return;
    }
    setSearchingCity(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/settings/autovit/location-search?type=cities&q=${encodeURIComponent(cityQuery)}`);
        const data = await res.json();
        if (data.results) setCityResults(data.results);
      } catch {
        // ignore
      } finally {
        setSearchingCity(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cityQuery]);

  // Load districts when districtsCityId changes (note: NOT cityId — Autovit uses a separate ID)
  useEffect(() => {
    const dcid = config.districtsCityId;
    if (!dcid) {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    (async () => {
      try {
        const res = await fetch(`/api/settings/autovit/location-search?type=districts&cityId=${dcid}`);
        const data = await res.json();
        setDistricts(data.results || []);
      } finally {
        setLoadingDistricts(false);
      }
    })();
  }, [config.districtsCityId]);

  function selectCity(c: LocationResult) {
    setConfig((prev) => ({
      ...prev,
      cityId: c.id,
      cityName: c.text || c.name,
      districtsCityId: c.districtsCityId || null,
      regionId: c.regionId || prev.regionId,
      regionName: c.regionName || prev.regionName,
      districtId: null,
      districtName: null,
    }));
    setCityQuery("");
    setCityResults([]);
  }

  function selectDistrict(d: LocationResult) {
    setConfig((prev) => ({ ...prev, districtId: d.id, districtName: d.name }));
  }

  function addPhone() {
    setConfig((prev) => ({ ...prev, contactPhones: [...prev.contactPhones, ""] }));
  }
  function updatePhone(i: number, val: string) {
    setConfig((prev) => {
      const phones = [...prev.contactPhones];
      phones[i] = val;
      return { ...prev, contactPhones: phones };
    });
  }
  function removePhone(i: number) {
    setConfig((prev) => ({ ...prev, contactPhones: prev.contactPhones.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/autovit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nu s-a putut salva", "Eroare");
        return;
      }
      toast.success("Setări Autovit salvate");
    } catch {
      toast.error("Eroare de rețea", "Eroare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-base font-semibold text-gray-900">Autovit — Setări dealer</h1>
        <p className="text-sm text-gray-500">
          Configurație globală pentru publicarea anunțurilor pe Autovit. Aceste date sunt folosite pentru
          fiecare anunț creat din CRM.
        </p>
      </div>

      {/* Locatie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locatia showroom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* City search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Oraș *</label>
            {config.cityId ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{config.cityName}</div>
                  {config.regionName && (
                    <div className="text-sm text-gray-500">Regiune: {config.regionName}</div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfig((p) => ({ ...p, cityId: null, cityName: null, districtId: null, districtName: null }))}
                >
                  Schimbă
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Caută oraș (ex: Bucuresti)..."
                  className="pl-9"
                />
                {searchingCity && <p className="mt-1 text-sm text-gray-500">Se caută...</p>}
                {cityResults.length > 0 && (
                  <div className="mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-sm">
                    {cityResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCity(c)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                      >
                        {c.text || c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* District */}
          {config.cityId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Sector / cartier</label>
              {loadingDistricts ? (
                <p className="text-sm text-gray-500">Se încarcă sectoarele...</p>
              ) : districts.length > 0 ? (
                <select
                  value={config.districtId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const d = districts.find((x) => x.id === id);
                    if (d) selectDistrict(d);
                    else setConfig((p) => ({ ...p, districtId: null, districtName: null }));
                  }}
                  className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">— fără sector —</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">Nu există sectoare pentru acest oraș.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Latitudine</label>
              <Input
                type="number"
                step="0.000001"
                value={config.latitude ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, latitude: e.target.value ? Number(e.target.value) : null }))}
                placeholder="44.4268"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Longitudine</label>
              <Input
                type="number"
                step="0.000001"
                value={config.longitude ?? ""}
                onChange={(e) => setConfig((p) => ({ ...p, longitude: e.target.value ? Number(e.target.value) : null }))}
                placeholder="26.1025"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact anunț</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Nume persoană contact</label>
            <Input
              value={config.contactPerson}
              onChange={(e) => setConfig((p) => ({ ...p, contactPerson: e.target.value }))}
              placeholder="Ex: Autoerebus"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">Telefoane contact</label>
              <Button type="button" size="sm" variant="outline" onClick={addPhone}>
                <Plus className="h-3 w-3 mr-1" /> Adaugă
              </Button>
            </div>
            <div className="space-y-2">
              {config.contactPhones.length === 0 && (
                <p className="text-sm italic text-gray-500">Niciun telefon adăugat.</p>
              )}
              {config.contactPhones.map((phone, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => updatePhone(i, e.target.value)}
                    placeholder="+40 7XX XXX XXX"
                  />
                  <button
                    type="button"
                    onClick={() => removePhone(i)}
                    className="rounded p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Tip anunțător</label>
            <select
              value={config.advertiserType}
              onChange={(e) => setConfig((p) => ({ ...p, advertiserType: e.target.value as any }))}
              className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
            >
              <option value="business">Business (dealer)</option>
              <option value="private">Persoană fizică</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Descriere */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Text adaugat la descriere</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-gray-500">
            Text opțional adăugat la finalul fiecărui anunț (ex: politica de garanție, contact, etc.)
          </p>
          <textarea
            value={config.defaultDescriptionSuffix}
            onChange={(e) => setConfig((p) => ({ ...p, defaultDescriptionSuffix: e.target.value }))}
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
            placeholder="Oferim garanție extinsă, service autorizat, asigurare facilă..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={save} disabled={saving || !config.cityId}>
          {saving ? (
            "Se salvează..."
          ) : (
            <>
              <Check className="mr-1 h-4 w-4" /> Salvează setările
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

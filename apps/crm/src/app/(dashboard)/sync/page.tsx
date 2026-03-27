"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui/components/card";
import { Button } from "@autoerebus/ui/components/button";
import { Badge } from "@autoerebus/ui/components/badge";
import {
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpDown,
  Loader2,
  Car,
  Upload,
  FileDown,
  FileUp,
} from "lucide-react";

interface SyncPreview {
  totalInAutorulate: number;
  totalInCRM: number;
  newCars: Array<{
    id: number;
    title: string;
    make: string;
    model: string;
    year: number;
    price: number;
    vin: string | null;
    status: string;
    updatedAt: string;
  }>;
  updatedCars: Array<{
    id: number;
    crmVehicleId: string;
    title: string;
    make: string;
    model: string;
    year: number;
    price: number;
    vin: string | null;
    status: string;
    updatedAt: string;
  }>;
  unchanged: number;
}

interface SyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

export default function SyncPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  // CSV state
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    total: number;
    imported: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function checkSync() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/sync/autorulate");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Eroare");
      setPreview(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la verificare");
    } finally {
      setLoading(false);
    }
  }

  async function executeSync(importNew: boolean, updateExisting: boolean) {
    setSyncing(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/sync/autorulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importNew, updateExisting }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Eroare");
      setResult(data.data);
      // Refresh preview after sync
      checkSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la sincronizare");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCsvExport() {
    window.location.href = "/api/vehicles/export";
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvImporting(true);
    setCsvError("");
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/vehicles/import", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Eroare");
      setCsvResult(data.data);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Eroare la import");
    } finally {
      setCsvImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8">
      {/* ─── Autorulate Sync Section ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Sincronizare Autorulate
          </h1>
          <p className="text-sm text-muted-foreground">
            Importa si actualizeaza vehiculele din site-ul Autorulate in CRM
          </p>
        </div>
        <Button onClick={checkSync} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Se verifica..." : "Verifica Modificari"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">
                Sincronizare finalizata
              </p>
              <p className="text-sm text-green-700">
                {result.imported} importate, {result.updated} actualizate
                {result.errors.length > 0 &&
                  `, ${result.errors.length} erori`}
              </p>
            </div>
          </CardContent>
          {result.errors.length > 0 && (
            <CardContent className="border-t border-green-200 p-4">
              <p className="mb-2 text-xs font-medium text-green-900">
                Erori:
              </p>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {err}
                  </p>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {!preview && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ArrowUpDown className="mb-3 h-10 w-10" />
            <p className="font-medium">
              Apasati &ldquo;Verifica Modificari&rdquo; pentru a incepe
            </p>
            <p className="mt-1 text-sm">
              Se va compara baza de date Autorulate cu CRM-ul
            </p>
          </CardContent>
        </Card>
      )}

      {preview && (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Total Autorulate
                </p>
                <p className="text-2xl font-bold">
                  {preview.totalInAutorulate}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total in CRM</p>
                <p className="text-2xl font-bold">{preview.totalInCRM}</p>
              </CardContent>
            </Card>
            <Card className={preview.newCars.length > 0 ? "border-blue-300" : ""}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Masini Noi</p>
                <p className="text-2xl font-bold text-blue-600">
                  {preview.newCars.length}
                </p>
              </CardContent>
            </Card>
            <Card className={preview.updatedCars.length > 0 ? "border-orange-300" : ""}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Modificate</p>
                <p className="text-2xl font-bold text-orange-600">
                  {preview.updatedCars.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action buttons */}
          {(preview.newCars.length > 0 ||
            preview.updatedCars.length > 0) && (
            <div className="flex gap-3">
              <Button
                onClick={() => executeSync(true, true)}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {syncing
                  ? "Se sincronizeaza..."
                  : `Sincronizeaza Tot (${preview.newCars.length + preview.updatedCars.length})`}
              </Button>
              {preview.newCars.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => executeSync(true, false)}
                  disabled={syncing}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Doar Importa Noi ({preview.newCars.length})
                </Button>
              )}
              {preview.updatedCars.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => executeSync(false, true)}
                  disabled={syncing}
                >
                  <RefreshCw className="h-4 w-4" />
                  Doar Actualizeaza ({preview.updatedCars.length})
                </Button>
              )}
            </div>
          )}

          {preview.newCars.length === 0 &&
            preview.updatedCars.length === 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">
                    Totul este sincronizat. {preview.unchanged} vehicule la zi.
                  </p>
                </CardContent>
              </Card>
            )}

          {/* New Cars Table */}
          {preview.newCars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                  Masini Noi de Importat ({preview.newCars.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">
                          ID
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Vehicul
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          An
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Pret
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          VIN
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Actualizat
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.newCars.map((car) => (
                        <tr
                          key={car.id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-4 py-2 font-mono text-xs">
                            #{car.id}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {car.make} {car.model}
                          </td>
                          <td className="px-4 py-2">{car.year}</td>
                          <td className="px-4 py-2">
                            {car.price > 0
                              ? `${car.price.toLocaleString("ro-RO")} EUR`
                              : "-"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {car.vin ?? "-"}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{car.status}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {new Date(car.updatedAt).toLocaleString("ro-RO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Updated Cars Table */}
          {preview.updatedCars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  Masini Modificate ({preview.updatedCars.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">
                          ID
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Vehicul
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          An
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Pret
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          VIN
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Actualizat
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.updatedCars.map((car) => (
                        <tr
                          key={car.id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="px-4 py-2 font-mono text-xs">
                            #{car.id}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {car.make} {car.model}
                          </td>
                          <td className="px-4 py-2">{car.year}</td>
                          <td className="px-4 py-2">
                            {car.price > 0
                              ? `${car.price.toLocaleString("ro-RO")} EUR`
                              : "-"}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {car.vin ?? "-"}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="secondary">{car.status}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {new Date(car.updatedAt).toLocaleString("ro-RO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ─── CSV Import/Export Section ─── */}
      <div className="border-t pt-8">
        <div className="mb-6">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            Import / Export CSV
          </h2>
          <p className="text-sm text-muted-foreground">
            Exporta sau importa vehicule in format CSV
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Export */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <FileDown className="h-10 w-10 text-blue-600" />
              <div className="text-center">
                <p className="font-medium">Export CSV</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Descarca toate vehiculele din CRM in format CSV
                </p>
              </div>
              <Button onClick={handleCsvExport} className="w-full">
                <Download className="h-4 w-4" />
                Descarca CSV
              </Button>
            </CardContent>
          </Card>

          {/* Import */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <FileUp className="h-10 w-10 text-green-600" />
              <div className="text-center">
                <p className="font-medium">Import CSV</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Importa vehicule din fisier CSV. Coloane obligatorii: Marca, Model, An, Pret, Combustibil, Transmisie, Brand
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={csvImporting}
              >
                {csvImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {csvImporting ? "Se importa..." : "Selecteaza Fisier CSV"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvImport}
              />
            </CardContent>
          </Card>
        </div>

        {/* CSV Import Result */}
        {csvResult && (
          <Card className="mt-4 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-900">
                  Import finalizat: {csvResult.imported} importate, {csvResult.updated} actualizate
                  din {csvResult.total} randuri
                </p>
              </div>
              {csvResult.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-green-900">Erori:</p>
                  {csvResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {csvError && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {csvError}
          </div>
        )}
      </div>
    </div>
  );
}

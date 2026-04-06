"use client";

import { useState, useEffect, useCallback } from "react";

interface Vehicle {
  id: string;
  title: string | null;
  year: number;
  price: number | null;
  discountPrice: number | null;
  mileage: number | null;
  fuelType: string | null;
  transmission: string | null;
  condition: string;
  status: string;
  brand: string;
  vin: string | null;
  autovitId: string | null;
  autovitSyncedAt: string | null;
  make: { name: string };
  model: { name: string };
  images: { url: string }[];
}

interface ActionResult {
  vehicleId: string;
  title: string;
  success: boolean;
  autovitId?: string;
  error?: string;
}

export default function AutovitPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [results, setResults] = useState<ActionResult[] | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (search) params.set("search", search);

      const res = await fetch(`/api/autovit?${params}`);
      const data = await res.json();
      if (data.success) setVehicles(data.data);
    } catch {
      console.error("Failed to fetch vehicles");
    }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetch("/api/autovit?action=status")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === vehicles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(vehicles.map((v) => v.id)));
    }
  };

  const performAction = async (action: string) => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      action === "publish"
        ? `Publică ${selected.size} vehicul(e) pe Autovit?`
        : action === "delete"
          ? `Șterge ${selected.size} anunț(uri) de pe Autovit?`
          : `${action === "activate" ? "Activează" : "Dezactivează"} ${selected.size} anunț(uri)?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/autovit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, vehicleIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        fetchVehicles();
        setSelected(new Set());
      }
    } catch {
      console.error("Action failed");
    }
    setActionLoading(false);
  };

  const syncedCount = vehicles.filter((v) => v.autovitId).length;
  const notSyncedCount = vehicles.filter((v) => !v.autovitId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Export Autovit</h2>
          <p className="text-sm text-gray-500">
            Publică și gestionează anunțuri pe Autovit.ro
          </p>
        </div>
      </div>

      {/* Status */}
      {configured === false && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm">
          <p className="font-medium text-yellow-800">Autovit API nu este configurat</p>
          <p className="mt-1 text-yellow-700">
            Adaugă variabilele de mediu: <code>AUTOVIT_CLIENT_ID</code>,{" "}
            <code>AUTOVIT_CLIENT_SECRET</code>, <code>AUTOVIT_USERNAME</code>,{" "}
            <code>AUTOVIT_PASSWORD</code>
          </p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          <p className="font-medium">
            Rezultate: {results.filter((r) => r.success).length}/{results.length} reușite
          </p>
          {results.map((r) => (
            <div
              key={r.vehicleId}
              className={`flex items-center gap-2 text-sm ${r.success ? "text-green-700" : "text-red-600"}`}
            >
              <span>{r.success ? "✓" : "✗"}</span>
              <span>{r.title}</span>
              {r.autovitId && <span className="text-gray-500">ID: {r.autovitId}</span>}
              {r.error && <span className="text-red-500">{r.error}</span>}
            </div>
          ))}
          <button onClick={() => setResults(null)} className="text-sm text-blue-600 hover:underline mt-1">
            Închide
          </button>
        </div>
      )}

      {/* Stats + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md ${filter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            Toate ({vehicles.length})
          </button>
          <button
            onClick={() => setFilter("synced")}
            className={`px-3 py-1.5 rounded-md ${filter === "synced" ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            Pe Autovit ({syncedCount})
          </button>
          <button
            onClick={() => setFilter("not-synced")}
            className={`px-3 py-1.5 rounded-md ${filter === "not-synced" ? "bg-orange-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            Nepublicate ({notSyncedCount})
          </button>
        </div>

        <input
          type="text"
          placeholder="Caută..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-8 w-48 rounded-md border px-2 text-sm"
        />
      </div>

      {/* Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-2 text-sm">
          <span className="font-medium">{selected.size} selectate</span>
          <button
            onClick={() => performAction("publish")}
            disabled={actionLoading}
            className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading ? "Se publică..." : "Publică pe Autovit"}
          </button>
          <button
            onClick={() => performAction("activate")}
            disabled={actionLoading}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Activează
          </button>
          <button
            onClick={() => performAction("deactivate")}
            disabled={actionLoading}
            className="rounded bg-yellow-600 px-3 py-1 text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            Dezactivează
          </button>
          <button
            onClick={() => performAction("delete")}
            disabled={actionLoading}
            className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Șterge de pe Autovit
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-500 hover:text-gray-700">
            Deselectează
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={selected.size === vehicles.length && vehicles.length > 0}
                  onChange={selectAll}
                  className="rounded"
                />
              </th>
              <th className="p-2 text-left">Imagine</th>
              <th className="p-2 text-left">Vehicul</th>
              <th className="p-2 text-left">An</th>
              <th className="p-2 text-right">Preț</th>
              <th className="p-2 text-left">KM</th>
              <th className="p-2 text-left">Brand</th>
              <th className="p-2 text-left">Status Autovit</th>
              <th className="p-2 text-left">Ultima sincronizare</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  Se încarcă...
                </td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  Niciun vehicul găsit
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr
                  key={v.id}
                  className={`border-b hover:bg-gray-50 cursor-pointer ${selected.has(v.id) ? "bg-blue-50" : ""}`}
                  onClick={() => toggleSelect(v.id)}
                >
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(v.id)}
                      onChange={() => toggleSelect(v.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-2">
                    {v.images[0] ? (
                      <img
                        src={v.images[0].url}
                        alt=""
                        className="h-10 w-14 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded bg-gray-200 flex items-center justify-center text-sm text-gray-400">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="font-medium">
                      {v.title || `${v.make.name} ${v.model.name}`}
                    </div>
                    {v.vin && (
                      <div className="text-sm text-gray-500">VIN: {v.vin}</div>
                    )}
                  </td>
                  <td className="p-2">{v.year}</td>
                  <td className="p-2 text-right font-medium">
                    {v.discountPrice ? (
                      <>
                        <span className="text-green-700">
                          {v.discountPrice.toLocaleString()} €
                        </span>
                        <br />
                        <span className="text-sm text-gray-500 line-through">
                          {v.price?.toLocaleString()} €
                        </span>
                      </>
                    ) : v.price ? (
                      `${v.price.toLocaleString()} €`
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {v.mileage ? `${v.mileage.toLocaleString()} km` : "-"}
                  </td>
                  <td className="p-2">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-sm">
                      {v.brand}
                    </span>
                  </td>
                  <td className="p-2">
                    {v.autovitId ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Publicat
                        </span>
                        <div className="text-sm text-gray-500 mt-0.5">
                          ID: {v.autovitId}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        Nepublicat
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-sm text-gray-500">
                    {v.autovitSyncedAt
                      ? new Date(v.autovitSyncedAt).toLocaleString("ro-RO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

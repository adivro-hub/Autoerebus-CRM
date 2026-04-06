"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@autoerebus/ui/components/button";
import { Badge } from "@autoerebus/ui/components/badge";
import {
  Card,
  CardContent,
} from "@autoerebus/ui/components/card";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Tags,
  Layers,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { createMake, updateMake, deleteMake } from "../makes/actions";
import { createModel, updateModel, deleteModel } from "../models/actions";

interface ModelData {
  id: string;
  name: string;
  slug: string;
  _count: { vehicles: number };
}

interface MakeData {
  id: string;
  name: string;
  slug: string;
  order: number;
  _count: { models: number; vehicles: number };
  models: ModelData[];
}

interface Props {
  makes: MakeData[];
}

export function MakesModelsSection({ makes }: Props) {
  const router = useRouter();
  const [expandedMakes, setExpandedMakes] = useState(false);
  const [expandedMakeId, setExpandedMakeId] = useState<string | null>(null);

  // Make form
  const [makeFormOpen, setMakeFormOpen] = useState(false);
  const [editingMake, setEditingMake] = useState<MakeData | null>(null);
  const [makeName, setMakeName] = useState("");
  const [makeError, setMakeError] = useState("");

  // Model form
  const [modelFormOpen, setModelFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelData | null>(null);
  const [modelMakeId, setModelMakeId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelError, setModelError] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: "make" | "model"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleMakeSave() {
    setMakeError("");
    const formData = new FormData();
    formData.set("name", makeName);
    formData.set("slug", makeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    formData.set("order", "0");

    const result = editingMake
      ? await updateMake(editingMake.id, formData)
      : await createMake(formData);

    if (result?.error) {
      setMakeError(result.error);
      return;
    }
    setMakeFormOpen(false);
    setEditingMake(null);
    setMakeName("");
    router.refresh();
  }

  async function handleModelSave() {
    setModelError("");
    const formData = new FormData();
    formData.set("name", modelName);
    formData.set("slug", modelName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    formData.set("makeId", modelMakeId);

    const result = editingModel
      ? await updateModel(editingModel.id, formData)
      : await createModel(formData);

    if (result?.error) {
      setModelError(result.error);
      return;
    }
    setModelFormOpen(false);
    setEditingModel(null);
    setModelName("");
    setModelMakeId("");
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = deleteTarget.type === "make"
      ? await deleteMake(deleteTarget.id)
      : await deleteModel(deleteTarget.id);

    if (result?.error) {
      alert(result.error);
    }
    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      {/* Marci & Modele */}
      <Card>
        <div className="flex w-full items-center justify-between p-4">
          <button
            onClick={() => setExpandedMakes(!expandedMakes)}
            className="flex items-center gap-2"
          >
            {expandedMakes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Tags className="h-4 w-4" />
            <span className="text-sm font-semibold">Marci & Modele</span>
            <Badge variant="secondary">{makes.length} marci</Badge>
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingMake(null);
              setMakeName("");
              setMakeFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Adauga Marca
          </Button>
        </div>

        {expandedMakes && (
          <CardContent className="border-t p-0">
            {makes.map((make) => (
              <div key={make.id} className="border-b last:border-b-0">
                {/* Make row */}
                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                  <button
                    onClick={() => setExpandedMakeId(expandedMakeId === make.id ? null : make.id)}
                    className="flex flex-1 items-center gap-2"
                  >
                    {expandedMakeId === make.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span className="text-sm font-medium">{make.name}</span>
                    <span className="text-sm text-gray-500">({make._count.models} modele, {make._count.vehicles} vehicule)</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingMake(make);
                        setMakeName(make.name);
                        setMakeFormOpen(true);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "make", id: make.id, name: make.name })}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Models */}
                {expandedMakeId === make.id && (
                  <div className="border-t bg-muted/20 px-4 py-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                        <Layers className="h-3 w-3" />
                        Modele {make.name}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-sm"
                        onClick={() => {
                          setEditingModel(null);
                          setModelName("");
                          setModelMakeId(make.id);
                          setModelFormOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Adauga Model
                      </Button>
                    </div>
                    {make.models.length === 0 ? (
                      <p className="py-2 text-sm text-gray-500">Niciun model</p>
                    ) : (
                      <div className="space-y-1">
                        {make.models.map((model) => (
                          <div key={model.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-background">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{model.name}</span>
                              <span className="text-sm text-gray-500">({model._count.vehicles} vehicule)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingModel(model);
                                  setModelName(model.name);
                                  setModelMakeId(make.id);
                                  setModelFormOpen(true);
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:text-foreground"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: "model", id: model.id, name: `${make.name} ${model.name}` })}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:text-red-600"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Make Form Modal */}
      {makeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h3 className="text-base font-semibold">{editingMake ? "Editeaza Marca" : "Adauga Marca"}</h3>
            {makeError && <p className="mt-2 text-sm text-destructive">{makeError}</p>}
            <div className="mt-4">
              <label className="text-sm font-medium">Nume Marca</label>
              <input
                type="text"
                value={makeName}
                onChange={(e) => setMakeName(e.target.value)}
                placeholder="Ex: Toyota"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setMakeFormOpen(false); setMakeError(""); }}>Anuleaza</Button>
              <Button onClick={handleMakeSave} disabled={!makeName.trim()}>Salveaza</Button>
            </div>
          </div>
        </div>
      )}

      {/* Model Form Modal */}
      {modelFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h3 className="text-base font-semibold">{editingModel ? "Editeaza Model" : "Adauga Model"}</h3>
            {modelError && <p className="mt-2 text-sm text-destructive">{modelError}</p>}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Marca</label>
                <select
                  value={modelMakeId}
                  onChange={(e) => setModelMakeId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteaza</option>
                  {makes.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Nume Model</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Ex: Corolla"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setModelFormOpen(false); setModelError(""); }}>Anuleaza</Button>
              <Button onClick={handleModelSave} disabled={!modelName.trim() || !modelMakeId}>Salveaza</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Sterge {deleteTarget.type === "make" ? "marca" : "modelul"}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Esti sigur ca vrei sa stergi <span className="font-medium text-foreground">{deleteTarget.name}</span>?
                  {deleteTarget.type === "make" && " Toate modelele asociate vor fi de asemenea sterse."}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Anuleaza</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Se sterge..." : "Sterge"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

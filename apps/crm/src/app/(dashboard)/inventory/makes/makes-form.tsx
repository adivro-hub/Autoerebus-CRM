"use client";

import { useState, useEffect } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@autoerebus/ui/components/dialog";
import { createMake, updateMake } from "./actions";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface MakeData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  order: number;
}

interface MakeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  make?: MakeData | null;
}

export function MakeForm({ open, onOpenChange, make }: MakeFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [order, setOrder] = useState("0");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const isEdit = !!make;

  useEffect(() => {
    if (open) {
      if (make) {
        setName(make.name);
        setSlug(make.slug);
        setLogo(make.logo ?? "");
        setOrder(String(make.order));
        setSlugManuallyEdited(true);
      } else {
        setName("");
        setSlug("");
        setLogo("");
        setOrder("0");
        setSlugManuallyEdited(false);
      }
      setError("");
    }
  }, [open, make]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("logo", logo);
    formData.set("order", order);

    const result = isEdit
      ? await updateMake(make.id, formData)
      : await createMake(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editeaza Marca" : "Adauga Marca"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificati datele marcii auto."
              : "Completati datele pentru o noua marca auto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            label="Nume *"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Volkswagen"
            required
          />

          <Input
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            placeholder="volkswagen"
          />

          <Input
            label="Logo (URL)"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://example.com/logo.png"
          />

          <Input
            label="Ordine"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Se salveaza..."
                : isEdit
                  ? "Salveaza"
                  : "Adauga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

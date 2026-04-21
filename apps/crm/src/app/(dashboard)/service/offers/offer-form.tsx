"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { ImageUploader, type UploadedImage } from "@/components/image-uploader";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

const BRANDS = [
  { value: "SERVICE", label: "Service" },
  { value: "NISSAN", label: "Nissan" },
  { value: "RENAULT", label: "Renault" },
  { value: "AUTORULATE", label: "Autorulate" },
  { value: "DAUNE", label: "Daune" },
] as const;

export interface OfferFormValues {
  id?: string;
  title: string;
  description: string;
  brand: string;
  validityText?: string;
  order: number;
  active: boolean;
  ctaUrl?: string;
  imageUrl?: string;
  imageCloudinaryId?: string;
}

export default function OfferForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: OfferFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OfferFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    brand: initial?.brand ?? "SERVICE",
    validityText: initial?.validityText ?? "",
    order: initial?.order ?? 0,
    active: initial?.active ?? true,
    ctaUrl: initial?.ctaUrl ?? "",
  });
  const [images, setImages] = useState<UploadedImage[]>(
    initial?.imageUrl
      ? [
          {
            url: initial.imageUrl,
            cloudinaryId: initial.imageCloudinaryId ?? "",
            order: 0,
          },
        ]
      : []
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const img = images[0];
    if (!img?.url) {
      setError("Imaginea este obligatorie");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        imageUrl: img.url,
        imageCloudinaryId: img.cloudinaryId,
        order: Number(values.order) || 0,
      };
      const url =
        mode === "create"
          ? "/api/service-offers"
          : `/api/service-offers/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Salvarea a eșuat");
        return;
      }
      router.push("/service/offers");
      router.refresh();
    } catch {
      setError("Eroare de conexiune");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <Link
        href="/service/offers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Înapoi la oferte
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        {mode === "create" ? "Ofertă nouă" : "Editare ofertă"}
      </h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Imagine *
              </label>
              <ImageUploader
                images={images.slice(0, 1)}
                onChange={(imgs) => setImages(imgs.slice(0, 1))}
                folder="autoerebus/offers"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Titlu *
                </label>
                <Input
                  required
                  value={values.title}
                  onChange={(e) =>
                    setValues({ ...values, title: e.target.value })
                  }
                  placeholder="Revizie completă"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Brand *
                </label>
                <select
                  required
                  value={values.brand}
                  onChange={(e) =>
                    setValues({ ...values, brand: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {BRANDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Descriere *
              </label>
              <textarea
                required
                rows={4}
                value={values.description}
                onChange={(e) =>
                  setValues({ ...values, description: e.target.value })
                }
                placeholder="Descriere scurtă a ofertei..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Valabilitate
                </label>
                <Input
                  value={values.validityText ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, validityText: e.target.value })
                  }
                  placeholder="Martie 2026 sau 01.03.2026 - 31.03.2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Ordine afișare
                </label>
                <Input
                  type="number"
                  value={values.order}
                  onChange={(e) =>
                    setValues({ ...values, order: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Link CTA (opțional)
              </label>
              <Input
                value={values.ctaUrl ?? ""}
                onChange={(e) =>
                  setValues({ ...values, ctaUrl: e.target.value })
                }
                placeholder="Implicit: deschide modal programare pe site"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(e) =>
                  setValues({ ...values, active: e.target.checked })
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">
                Ofertă activă (vizibilă pe site)
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 mt-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Creează oferta" : "Salvează modificările"}
          </Button>
          <Link href="/service/offers">
            <Button type="button" variant="outline">
              Anulează
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { cn } from "@autoerebus/ui/lib/utils";
import { Upload, X, GripVertical, Loader2, ImagePlus } from "lucide-react";

export interface UploadedImage {
  url: string;
  cloudinaryId: string;
  order: number;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  folder?: string;
}

export function ImageUploader({
  images,
  onChange,
  folder = "autoerebus/vehicles",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      try {
        // Get signature from our API
        const sigRes = await fetch("/api/cloudinary-signature");
        const sigData = await sigRes.json();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", sigData.apiKey);
        formData.append("timestamp", sigData.timestamp.toString());
        formData.append("signature", sigData.signature);
        formData.append("folder", sigData.folder || folder);
        formData.append(
          "transformation",
          "c_limit,w_1920,h_1440,q_auto,f_auto"
        );

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
          { method: "POST", body: formData }
        );

        if (!uploadRes.ok) throw new Error("Upload failed");

        const uploadData = await uploadRes.json();

        return {
          url: uploadData.secure_url,
          cloudinaryId: uploadData.public_id,
          order: images.length,
        };
      } catch (error) {
        console.error("Upload error:", error);
        return null;
      }
    },
    [images.length, folder]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );

      if (fileArray.length === 0) return;

      setUploading(true);
      const successful: UploadedImage[] = [];

      // Upload in batches of 3 to avoid overwhelming the server
      const batchSize = 3;
      for (let i = 0; i < fileArray.length; i += batchSize) {
        const batch = fileArray.slice(i, i + batchSize);
        setUploadProgress(`${Math.min(i + batchSize, fileArray.length)}/${fileArray.length}`);

        const results = await Promise.all(batch.map(uploadToCloudinary));
        for (const r of results) {
          if (r) successful.push(r);
        }
      }

      if (successful.length > 0) {
        const updated = [...images, ...successful].map((img, idx) => ({
          ...img,
          order: idx,
        }));
        onChange(updated);
      }

      setUploading(false);
      setUploadProgress("");
    },
    [images, onChange, uploadToCloudinary]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    async (index: number) => {
      const image = images[index];

      // Delete from Cloudinary
      try {
        await fetch("/api/cloudinary-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: image.cloudinaryId }),
        });
      } catch {
        // Continue even if Cloudinary delete fails
      }

      const updated = images
        .filter((_, i) => i !== index)
        .map((img, i) => ({ ...img, order: i }));
      onChange(updated);
    },
    [images, onChange]
  );

  // Drag reorder handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...images];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, moved);
    const reordered = updated.map((img, i) => ({ ...img, order: i }));
    onChange(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Se incarca... {uploadProgress}
            </p>
          </>
        ) : (
          <>
            <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Trageti imagini aici sau click pentru a selecta
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, WebP.
              {images.length > 0 && ` ${images.length} imagini incarcate`}
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {images.map((image, index) => (
            <div
              key={image.cloudinaryId || index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted",
                draggedIndex === index && "opacity-50"
              )}
            >
              <img
                src={image.url}
                alt={`Imagine ${index + 1}`}
                className="h-full w-full object-cover"
              />

              {/* Overlay controls */}
              <div className="absolute inset-0 flex items-start justify-between bg-black/0 p-1.5 transition-colors group-hover:bg-black/30">
                <div className="cursor-grab rounded bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-4 w-4 text-white" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="rounded-full bg-red-500 p-0.5 opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>

              {/* Order badge */}
              {index === 0 && (
                <div className="absolute bottom-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  Principala
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

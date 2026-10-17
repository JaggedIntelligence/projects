"use client";

import { UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { allowedImageTypes, maxImageUploadBatchSize, maxImageUploadBytes } from "@/lib/validators";

type UploadStatus = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  name: string;
  status: UploadStatus;
};

const acceptedTypes = allowedImageTypes.join(",");

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploader() {
  const utils = api.useUtils();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  async function resetAfterUpload() {
    await utils.images.list.invalidate();
    setFiles([]);
    setQueue([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFiles(nextFiles: FileList | null) {
    setError(null);
    const imageFiles = Array.from(nextFiles ?? []);

    if (imageFiles.length > maxImageUploadBatchSize) {
      setError(`Choose ${maxImageUploadBatchSize} images or fewer at a time.`);
      return;
    }

    const invalidFile = imageFiles.find((file) => !allowedImageTypes.includes(file.type as (typeof allowedImageTypes)[number]));
    if (invalidFile) {
      setError(`${invalidFile.name} is not a supported image type.`);
      return;
    }

    const oversizedFile = imageFiles.find((file) => file.size > maxImageUploadBytes);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than ${formatBytes(maxImageUploadBytes)}.`);
      return;
    }

    setFiles(imageFiles);
    setQueue(imageFiles.map((file) => ({ name: file.name, status: "queued" })));
  }

  async function uploadImages() {
    if (!files.length) return;

    setError(null);
    setIsUploading(true);
    setQueue(files.map((file) => ({ name: file.name, status: "uploading" })));

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/images/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Images could not upload.");
      }

      setQueue((current) => current.map((item) => ({ ...item, status: "done" })));
      await resetAfterUpload();
    } catch (uploadError) {
      setQueue((current) => current.map((item) => (item.status === "uploading" ? { ...item, status: "error" } : item)));
      setError(uploadError instanceof Error ? uploadError.message : "Images could not upload.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-2">
            <Input ref={inputRef} type="file" accept={acceptedTypes} multiple onChange={(event) => selectFiles(event.target.files)} />
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Up to {formatBytes(maxImageUploadBytes)} each.</p>
          </div>
          <Button type="button" onClick={uploadImages} disabled={!files.length || isUploading}>
            <UploadCloud className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload images"}
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {queue.length ? (
          <div className="grid gap-2">
            {queue.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 capitalize text-muted-foreground">{item.status}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

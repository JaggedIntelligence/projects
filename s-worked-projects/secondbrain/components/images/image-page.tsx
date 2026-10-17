"use client";

import { ImagePlus } from "lucide-react";

import { ImageGrid } from "@/components/images/image-grid";
import { ImageUploader } from "@/components/images/image-uploader";
import { api } from "@/components/providers/trpc-provider";

export function ImagePage() {
  const health = api.images.health.useQuery(undefined, {
    retry: false
  });

  return (
    <main className="container grid gap-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Images</h1>
          <p className="text-sm text-muted-foreground">Upload, browse, rename, and remove your R2 image library.</p>
          {health.isError ? <p className="mt-2 text-sm text-destructive">R2 health check failed: {health.error.message}</p> : null}
          {health.data?.ok ? <p className="mt-2 text-xs text-muted-foreground">R2 bucket connected: {health.data.bucketName}</p> : null}
        </div>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <ImagePlus className="h-4 w-4" />
          Multi-image upload
        </div>
      </div>
      <ImageUploader />
      <ImageGrid />
    </main>
  );
}

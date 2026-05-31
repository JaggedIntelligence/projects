"use client";

import { format } from "date-fns";
import { ExternalLink, ImageIcon, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import { ImagePreviewDialog } from "@/components/images/image-preview-dialog";
import { ImageRenameDialog } from "@/components/images/image-rename-dialog";
import { api } from "@/components/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppRouter } from "@/server/api/root";

type ImageItem = inferRouterOutputs<AppRouter>["images"]["list"][number];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageGrid() {
  const utils = api.useUtils();
  const [renamingImage, setRenamingImage] = useState<ImageItem | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const query = api.images.list.useQuery();
  const deleteImage = api.images.delete.useMutation({
    onSuccess: () => utils.images.list.invalidate()
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="aspect-[4/3] animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-lg font-semibold">Images could not load</h2>
          <p className="max-w-md text-sm text-muted-foreground">Check your R2 environment variables, bucket access, and metadata JSON.</p>
          <p className="max-w-md text-xs text-destructive">{query.error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!query.data?.length) {
    return (
      <Card>
        <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">No images yet</h2>
            <p className="text-sm text-muted-foreground">Choose a few images above and upload them to R2.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.map((image) => (
          <Card key={image.id} className="overflow-hidden">
            <button
              type="button"
              className="relative block aspect-[4/3] w-full bg-muted text-left"
              aria-label={`Preview ${image.fileName}`}
              onClick={() => setPreviewImage(image)}
            >
              <Image
                src={image.url}
                alt={image.fileName}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                unoptimized
                className="object-cover"
              />
            </button>
            <CardContent className="grid gap-3 p-4">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{image.fileName}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(image.size)} - {format(new Date(image.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="Open image" asChild>
                  <a href={image.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="Rename image" onClick={() => setRenamingImage(image)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Delete image"
                  disabled={deleteImage.isPending}
                  onClick={() => deleteImage.mutate({ id: image.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ImagePreviewDialog image={previewImage} onOpenChange={(open) => !open && setPreviewImage(null)} />
      <ImageRenameDialog image={renamingImage} onOpenChange={(open) => !open && setRenamingImage(null)} />
    </>
  );
}

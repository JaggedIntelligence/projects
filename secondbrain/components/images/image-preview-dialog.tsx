"use client";

import type { inferRouterOutputs } from "@trpc/server";
import Image from "next/image";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppRouter } from "@/server/api/root";

type ImageItem = inferRouterOutputs<AppRouter>["images"]["list"][number];

export function ImagePreviewDialog({ image, onOpenChange }: { image: ImageItem | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(image)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 p-3 sm:w-[66vw] sm:max-w-[66vw]">
        {image ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{image.fileName}</DialogTitle>
            </DialogHeader>
            <div className="relative h-[66vh] w-full overflow-hidden rounded-md bg-muted">
              <Image src={image.url} alt={image.fileName} fill sizes="66vw" unoptimized className="object-contain" priority />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

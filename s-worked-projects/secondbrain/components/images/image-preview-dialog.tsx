"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppRouter } from "@/server/api/root";

type ImageItem = inferRouterOutputs<AppRouter>["images"]["list"][number];

export function ImagePreviewDialog({
  image,
  canNavigate,
  onNext,
  onOpenChange,
  onPrevious
}: {
  image: ImageItem | null;
  canNavigate: boolean;
  onNext: () => void;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
}) {
  useEffect(() => {
    if (!image || !canNavigate) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canNavigate, image, onNext, onPrevious]);

  return (
    <Dialog open={Boolean(image)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] gap-3 p-3 sm:w-[90vw] sm:max-w-[90vw]">
        {image ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{image.fileName}</DialogTitle>
            </DialogHeader>
            <div className="relative h-[90vh] w-full overflow-hidden rounded-md bg-muted">
              <Image src={image.url} alt={image.fileName} fill sizes="90vw" unoptimized className="object-contain" priority />
              {canNavigate ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/90 shadow"
                    onClick={onPrevious}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/90 shadow"
                    onClick={onNext}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

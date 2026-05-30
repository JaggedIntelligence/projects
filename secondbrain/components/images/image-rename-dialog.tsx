"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";

import { api } from "@/components/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRouter } from "@/server/api/root";

type ImageItem = inferRouterOutputs<AppRouter>["images"]["list"][number];

export function ImageRenameDialog({ image, onOpenChange }: { image: ImageItem | null; onOpenChange: (open: boolean) => void }) {
  const utils = api.useUtils();
  const [fileName, setFileName] = useState("");
  const renameImage = api.images.rename.useMutation({
    onSuccess: async () => {
      await utils.images.list.invalidate();
      onOpenChange(false);
    }
  });

  useEffect(() => {
    setFileName(image?.fileName ?? "");
  }, [image]);

  function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) return;

    renameImage.mutate({
      id: image.id,
      fileName
    });
  }

  return (
    <Dialog open={Boolean(image)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename image</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submitRename}>
          <div className="grid gap-2">
            <Label htmlFor="image-file-name">File name</Label>
            <Input id="image-file-name" value={fileName} onChange={(event) => setFileName(event.target.value)} />
            {renameImage.error ? <p className="text-sm text-destructive">{renameImage.error.message}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!fileName.trim() || renameImage.isPending}>
              {renameImage.isPending ? "Saving..." : "Save name"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

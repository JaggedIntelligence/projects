export function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "image";
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.replace(/^-+|-+$/g, "") || "image";
}

export function createImageKey(userId: string, id: string, fileName: string) {
  return `images/${userId}/${id}-${sanitizeFileName(fileName)}`;
}

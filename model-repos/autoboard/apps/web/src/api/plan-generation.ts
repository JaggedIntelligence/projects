import type { Card } from "~/api/cards";

const DEFAULT_TIMEOUT_MS = 120_000;

export async function generatePlan(
  projectId: string,
  description: string,
  options?: { timeoutMs?: number }
): Promise<{ cards: Card[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    const response = await fetch("/api/plan-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, description }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Failed to generate plan (${response.status})`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getPlanGenerationStatus(
  projectId: string
): Promise<{ isGenerating: boolean }> {
  const response = await fetch(
    `/api/plan-generation/status?projectId=${encodeURIComponent(projectId)}`
  );
  if (!response.ok) throw new Error("Failed to get plan generation status");
  return response.json();
}

export async function cancelPlanGeneration(projectId: string): Promise<void> {
  const response = await fetch("/api/plan-generation", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!response.ok) throw new Error("Failed to cancel plan generation");
}

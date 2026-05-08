export interface RunCardParams {
  cardId: string;
  prompt?: string;
  model?: string;
}

export interface RunCardResponse {
  success: boolean;
  cardId: string;
  status: "started";
  projectPath: string;
  prompt: string;
}

export interface RunStatusResponse {
  status: "running" | "completed" | "error" | "not_found";
  messageCount: number;
  messages: unknown[];
  error?: string;
}

export async function runCard(params: RunCardParams): Promise<RunCardResponse> {
  const response = await fetch("/api/run-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to start card");
  }
  return response.json();
}

export async function getRunStatus(cardId: string): Promise<RunStatusResponse> {
  const response = await fetch(
    `/api/run-card?cardId=${encodeURIComponent(cardId)}`
  );
  if (!response.ok) throw new Error("Failed to get run status");
  return response.json();
}

export async function cancelRun(cardId: string): Promise<void> {
  const response = await fetch("/api/run-card", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
  if (!response.ok) throw new Error("Failed to cancel run");
}

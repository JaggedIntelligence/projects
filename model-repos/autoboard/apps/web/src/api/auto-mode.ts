export interface AutoModeStatus {
  projectId: string;
  enabled: boolean;
  maxConcurrency: number;
  loopRunning: boolean;
  activeRunCount: number;
  activeCardIds: string[];
}

export async function getAutoModeStatus(projectId: string): Promise<AutoModeStatus> {
  if (!projectId) {
    return {
      projectId: "",
      enabled: false,
      maxConcurrency: 1,
      loopRunning: false,
      activeRunCount: 0,
      activeCardIds: [],
    };
  }
  const response = await fetch(
    `/api/auto-mode?projectId=${encodeURIComponent(projectId)}`
  );
  if (!response.ok) throw new Error("Failed to get auto mode status");
  return response.json();
}

export async function toggleAutoMode(
  projectId: string,
  enabled: boolean
): Promise<void> {
  const response = await fetch("/api/auto-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, enabled }),
  });
  if (!response.ok) throw new Error("Failed to toggle auto mode");
}

export async function setAutoModeConcurrency(
  projectId: string,
  maxConcurrency: number
): Promise<void> {
  const response = await fetch("/api/auto-mode", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, maxConcurrency }),
  });
  if (!response.ok) throw new Error("Failed to set concurrency");
}

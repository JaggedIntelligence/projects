export interface CardLogEntry {
  id: string;
  cardId: string;
  type: string;
  content: string;
  sequence: number;
  createdAt: string;
}

export interface LogStreamHandlers {
  onLog?: (event: {
    cardId: string;
    type: string;
    content: string;
    sequence: number;
  }) => void;
  onStatus?: (event: {
    cardId: string;
    status: string;
    error?: string;
    needsInput?: boolean;
  }) => void;
  onNeedsInput?: (event: { cardId: string; needsInput: boolean }) => void;
}

export async function getCardLogs(cardId: string): Promise<CardLogEntry[]> {
  const response = await fetch(
    `/api/card-logs?cardId=${encodeURIComponent(cardId)}`
  );
  if (!response.ok) throw new Error("Failed to fetch card logs");
  return response.json();
}

export function subscribeToCardLogs(
  cardId: string,
  handlers: LogStreamHandlers
): EventSource {
  const es = new EventSource(
    `/api/card-logs-stream?cardId=${encodeURIComponent(cardId)}`
  );
  es.addEventListener("log", (e) => {
    handlers.onLog?.(JSON.parse((e as MessageEvent).data));
  });
  es.addEventListener("status", (e) => {
    handlers.onStatus?.(JSON.parse((e as MessageEvent).data));
  });
  es.addEventListener("needsInput", (e) => {
    handlers.onNeedsInput?.(JSON.parse((e as MessageEvent).data));
  });
  return es;
}

export async function sendCardInput(
  cardId: string,
  message: string
): Promise<void> {
  const response = await fetch("/api/card-input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, message }),
  });
  if (!response.ok) throw new Error("Failed to send input");
}

export async function getNeedsInput(): Promise<Record<string, boolean>> {
  const response = await fetch("/api/needs-input");
  if (!response.ok) return {};
  return response.json();
}

export async function getRunningCards(): Promise<Record<string, boolean>> {
  const response = await fetch("/api/running-cards");
  if (!response.ok) return {};
  return response.json();
}

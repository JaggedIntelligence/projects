import type { Card, CreateCardParams, UpdateCardParams } from "@autoboard/shared";

export type { Card, CreateCardParams, UpdateCardParams };

export async function getCards(projectId: string): Promise<Card[]> {
  if (!projectId) return [];
  const response = await fetch(`/api/cards?projectId=${encodeURIComponent(projectId)}`);
  if (!response.ok) throw new Error("Failed to fetch cards");
  return response.json();
}

export async function getArchivedCards(projectId: string): Promise<Card[]> {
  if (!projectId) return [];
  const response = await fetch(
    `/api/cards?projectId=${encodeURIComponent(projectId)}&archived=true`
  );
  if (!response.ok) throw new Error("Failed to fetch archived cards");
  return response.json();
}

export async function createCard(params: CreateCardParams): Promise<Card> {
  const response = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error("Failed to create card");
  return response.json();
}

export async function updateCard(id: string, updates: UpdateCardParams): Promise<Card> {
  const response = await fetch("/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!response.ok) throw new Error("Failed to update card");
  return response.json();
}

export async function deleteCard(id: string): Promise<void> {
  const response = await fetch("/api/cards", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error("Failed to delete card");
}

export async function archiveCard(id: string): Promise<Card> {
  const response = await fetch("/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, archivedAt: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("Failed to archive card");
  return response.json();
}

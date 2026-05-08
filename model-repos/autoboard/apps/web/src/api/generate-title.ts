import type { Card } from "@autoboard/shared";

export interface GenerateTitleResponse {
  title: string;
  card: Card;
}

export async function generateTitle(
  cardId: string
): Promise<GenerateTitleResponse> {
  const response = await fetch("/api/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
  if (!response.ok) throw new Error("Failed to generate title");
  return response.json();
}

import { cardRunStateService } from "@autoboard/services";
import { ValidationError } from "@autoboard/shared";

export interface GetCardRunStatusInput {
  cardId: string;
}

export interface GetCardRunStatusResult {
  status: "not_found" | "running" | "completed" | "error";
  messageCount: number;
  messages: unknown[];
  error?: string;
}

export class GetCardRunStatusUseCase {
  async execute(input: GetCardRunStatusInput): Promise<GetCardRunStatusResult> {
    if (!input.cardId) throw new ValidationError("cardId is required");

    const run = cardRunStateService.getRun(input.cardId);
    if (!run) {
      return { status: "not_found", messageCount: 0, messages: [] };
    }
    return {
      status: run.status,
      messageCount: run.messages.length,
      messages: run.messages,
      error: run.error,
    };
  }
}

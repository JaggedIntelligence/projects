import { cardRunStateService } from "@autoboard/services";
import { ValidationError, NotFoundError } from "@autoboard/shared";

export interface CancelCardRunInput {
  cardId: string;
}

export interface CancelCardRunResult {
  success: boolean;
  status: "running" | "completed" | "error";
}

export class CancelCardRunUseCase {
  async execute(input: CancelCardRunInput): Promise<CancelCardRunResult> {
    if (!input.cardId) throw new ValidationError("cardId is required");

    const run = cardRunStateService.getRun(input.cardId);
    if (!run) throw new NotFoundError("No active run found");

    if (run.status === "running") cardRunStateService.cancelRun(input.cardId);
    const updatedRun = cardRunStateService.getRun(input.cardId);
    return {
      success: true,
      status: updatedRun?.status || "error",
    };
  }
}

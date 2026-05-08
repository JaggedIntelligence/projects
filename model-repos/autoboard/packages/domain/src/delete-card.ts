import type { CardRepository } from "@autoboard/db";
import { ValidationError } from "@autoboard/shared";

export interface DeleteCardInput {
  id: string;
}

export interface DeleteCardResult {
  success: boolean;
}

export class DeleteCardUseCase {
  constructor(private cardRepository: CardRepository) {}

  async execute(input: DeleteCardInput): Promise<DeleteCardResult> {
    if (!input.id) throw new ValidationError("Card ID is required");
    await this.cardRepository.deleteCard(input.id);
    return { success: true };
  }
}

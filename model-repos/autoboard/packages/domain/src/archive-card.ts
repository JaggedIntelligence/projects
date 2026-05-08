import type { Card } from "@autoboard/db";
import type { CardRepository } from "@autoboard/db";
import { ValidationError, NotFoundError } from "@autoboard/shared";

export interface ArchiveCardInput {
  id: string;
}

export interface ArchiveCardResult {
  card: Card;
}

export class ArchiveCardUseCase {
  constructor(private cardRepository: CardRepository) {}

  async execute(input: ArchiveCardInput): Promise<ArchiveCardResult> {
    if (!input.id) throw new ValidationError("Card ID is required");

    const existing = await this.cardRepository.getCardById(input.id);
    if (!existing) throw new NotFoundError("Card not found");

    const card = await this.cardRepository.updateCard(input.id, {
      archivedAt: new Date(),
      updatedAt: new Date(),
    });
    return { card };
  }
}

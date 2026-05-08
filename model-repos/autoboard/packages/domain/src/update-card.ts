import type { Card, UpdateCardData } from "@autoboard/db";
import type { CardRepository } from "@autoboard/db";
import { ValidationError, NotFoundError } from "@autoboard/shared";

export interface UpdateCardInput {
  id: string;
  columnId?: string;
  title?: string;
  description?: string;
  archivedAt?: Date;
}

export interface UpdateCardResult {
  card: Card;
}

export class UpdateCardUseCase {
  constructor(private cardRepository: CardRepository) {}

  async execute(input: UpdateCardInput): Promise<UpdateCardResult> {
    if (!input.id) throw new ValidationError("Card ID is required");

    const updateData: UpdateCardData = { updatedAt: new Date() };
    if (input.columnId !== undefined) updateData.columnId = input.columnId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.archivedAt !== undefined) updateData.archivedAt = input.archivedAt;

    try {
      const card = await this.cardRepository.updateCard(input.id, updateData);
      return { card };
    } catch (error) {
      if (error instanceof Error && error.message === "Card not found") {
        throw new NotFoundError("Card not found");
      }
      throw error;
    }
  }
}

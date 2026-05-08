import type { Card } from "@autoboard/db";
import type { CardRepository } from "@autoboard/db";

export interface GetCardsInput {
  projectId?: string;
}

export interface GetCardsResult {
  cards: Card[];
}

export class GetCardsUseCase {
  constructor(private cardRepository: CardRepository) {}

  async execute(input: GetCardsInput): Promise<GetCardsResult> {
    const cards = input.projectId
      ? await this.cardRepository.getCardsByProjectId(input.projectId)
      : await this.cardRepository.getAllCards();
    return { cards };
  }
}

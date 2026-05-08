import type { Context } from "hono";
import { GenerateCardTitleUseCase } from "@autoboard/domain";
import type { CardRepository, ProjectRepository } from "@autoboard/db";
import { claudeProvider } from "@autoboard/services";
import { handleDomainError } from "../error-handler.js";

export function createGenerateTitleController(
  cardRepository: CardRepository,
  projectRepository: ProjectRepository
) {
  const useCase = new GenerateCardTitleUseCase(
    cardRepository,
    projectRepository,
    claudeProvider
  );

  return {
    async post(c: Context) {
      try {
        const body = await c.req.json();
        const { cardId } = body;
        const result = await useCase.execute({ cardId });
        return c.json({ title: result.title, card: result.card });
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

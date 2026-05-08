import type { Context } from "hono";
import {
  StartCardRunUseCase,
  GetCardRunStatusUseCase,
  CancelCardRunUseCase,
} from "@autoboard/domain";
import type { CardRepository, ProjectRepository } from "@autoboard/db";
import { handleDomainError } from "../error-handler.js";

export function createRunCardController(
  cardRepository: CardRepository,
  projectRepository: ProjectRepository
) {
  const startRun = new StartCardRunUseCase(cardRepository, projectRepository);
  const getStatus = new GetCardRunStatusUseCase();
  const cancelRun = new CancelCardRunUseCase();

  return {
    async post(c: Context) {
      try {
        const body = await c.req.json();
        const { cardId, prompt: overridePrompt, model } = body;
        const result = await startRun.execute({
          cardId,
          prompt: overridePrompt,
          model,
        });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async get(c: Context) {
      try {
        const url = new URL(c.req.url);
        const cardId = url.searchParams.get("cardId") || "";
        const result = await getStatus.execute({ cardId });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async delete(c: Context) {
      try {
        const body = await c.req.json();
        const { cardId } = body;
        const result = await cancelRun.execute({ cardId });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

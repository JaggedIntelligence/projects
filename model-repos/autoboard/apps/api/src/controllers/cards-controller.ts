import type { Context } from "hono";
import {
  GetCardsUseCase,
  CreateCardUseCase,
  UpdateCardUseCase,
  DeleteCardUseCase,
  GetArchivedCardsUseCase,
} from "@autoboard/domain";
import type { CardRepository } from "@autoboard/db";
import { handleDomainError } from "../error-handler.js";

export function createCardsController(cardRepository: CardRepository) {
  const getCards = new GetCardsUseCase(cardRepository);
  const createCard = new CreateCardUseCase(cardRepository);
  const updateCard = new UpdateCardUseCase(cardRepository);
  const deleteCard = new DeleteCardUseCase(cardRepository);
  const getArchivedCards = new GetArchivedCardsUseCase(cardRepository);

  return {
    async get(c: Context) {
      try {
        const url = new URL(c.req.url);
        const projectId = url.searchParams.get("projectId") || undefined;
        const archived = url.searchParams.get("archived");

        if (archived === "true" && projectId) {
          const result = await getArchivedCards.execute({ projectId });
          return c.json(result.cards);
        }
        const result = await getCards.execute({ projectId });
        return c.json(result.cards);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async post(c: Context) {
      try {
        const body = await c.req.json();
        const { title, description, columnId, projectId } = body;
        const result = await createCard.execute({
          title,
          description,
          columnId,
          projectId,
        });
        return c.json(result.card, 201);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async patch(c: Context) {
      try {
        const body = await c.req.json();
        const { id, columnId, title, description, archivedAt } = body;
        const result = await updateCard.execute({
          id,
          columnId,
          title,
          description,
          archivedAt: archivedAt ? new Date(archivedAt) : undefined,
        });
        return c.json(result.card);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async delete(c: Context) {
      try {
        const body = await c.req.json();
        const { id } = body;
        const result = await deleteCard.execute({ id });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

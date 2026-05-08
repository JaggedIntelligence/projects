import type { Context } from "hono";
import { GeneratePlanUseCase } from "@autoboard/domain";
import type { CardRepository, ProjectRepository } from "@autoboard/db";
import { handleDomainError } from "../error-handler.js";

const generatingProjects = new Set<string>();
const abortControllers = new Map<string, AbortController>();

export function createPlanGenerationController(
  cardRepository: CardRepository,
  projectRepository: ProjectRepository
) {
  const generatePlan = new GeneratePlanUseCase(
    cardRepository,
    projectRepository
  );

  return {
    async post(c: Context) {
      const body = await c.req.json();
      const { projectId, description } = body;
      if (!projectId) {
        return c.json({ error: "projectId is required" }, 400);
      }

      const abortController = new AbortController();
      abortControllers.set(projectId, abortController);
      generatingProjects.add(projectId);

      try {
        const result = await generatePlan.execute({
          projectId,
          description,
          abortController,
        });
        return c.json({ cards: result.cards });
      } catch (error) {
        return handleDomainError(error, c);
      } finally {
        abortControllers.delete(projectId);
        generatingProjects.delete(projectId);
      }
    },

    get(c: Context) {
      const url = new URL(c.req.url);
      const projectId = url.searchParams.get("projectId") ?? "";
      return c.json({
        isGenerating: projectId ? generatingProjects.has(projectId) : false,
      });
    },

    async delete(c: Context) {
      try {
        const body = await c.req.json();
        const { projectId } = body;
        if (!projectId) {
          return c.json({ error: "projectId is required" }, 400);
        }
        const controller = abortControllers.get(projectId);
        if (controller) {
          controller.abort();
          abortControllers.delete(projectId);
          generatingProjects.delete(projectId);
        }
        return c.json({ success: true });
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

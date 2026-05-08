import type { Context } from "hono";
import {
  GetProjectsUseCase,
  CreateProjectUseCase,
  DeleteProjectUseCase,
  UpdateProjectUseCase,
} from "@autoboard/domain";
import type {
  ProjectRepository,
  AutoModeSettingsRepository,
} from "@autoboard/db";
import type { IAutoModeLoop } from "@autoboard/shared";
import { handleDomainError } from "../error-handler.js";

export function createProjectsController(
  projectRepository: ProjectRepository,
  autoModeSettingsRepository: AutoModeSettingsRepository,
  autoModeLoop: IAutoModeLoop
) {
  const getProjects = new GetProjectsUseCase(projectRepository);
  const createProject = new CreateProjectUseCase(projectRepository);
  const deleteProject = new DeleteProjectUseCase(
    projectRepository,
    autoModeSettingsRepository,
    autoModeLoop
  );
  const updateProject = new UpdateProjectUseCase(projectRepository);

  return {
    async get(c: Context) {
      try {
        const result = await getProjects.execute();
        return c.json(result.projects);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async post(c: Context) {
      try {
        const body = await c.req.json();
        const { name, filePath } = body;
        const result = await createProject.execute({ name, filePath });
        return c.json(result.project, 201);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async patch(c: Context) {
      try {
        const body = await c.req.json();
        const { id, name, filePath } = body;
        const result = await updateProject.execute({ id, name, filePath });
        return c.json(result.project);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async delete(c: Context) {
      try {
        const body = await c.req.json();
        const { id } = body;
        const result = await deleteProject.execute({ id });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import type { Project, CreateProjectData } from "@autoboard/db";
import type { ProjectRepository } from "@autoboard/db";
import { ValidationError } from "@autoboard/shared";

export interface CreateProjectInput {
  name: string;
  filePath: string;
}

export interface CreateProjectResult {
  project: Project;
}

export class CreateProjectUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(input: CreateProjectInput): Promise<CreateProjectResult> {
    if (!input.name || !input.filePath) {
      throw new ValidationError("Name and filePath are required");
    }
    if (!existsSync(input.filePath)) {
      mkdirSync(input.filePath, { recursive: true });
    }

    const id = randomUUID();
    const now = new Date();
    const projectData: CreateProjectData = {
      id,
      name: input.name,
      filePath: input.filePath,
      createdAt: now,
      updatedAt: now,
    };
    const project = await this.projectRepository.createProject(projectData);
    return { project };
  }
}

import type { Project } from "@autoboard/db";
import type { ProjectRepository } from "@autoboard/db";

export interface GetProjectsResult {
  projects: Project[];
}

export class GetProjectsUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(): Promise<GetProjectsResult> {
    const projects = await this.projectRepository.getAllProjects();
    return { projects };
  }
}

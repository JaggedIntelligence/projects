import type { ProjectRepository } from "@autoboard/db";
import type { AutoModeSettingsRepository } from "@autoboard/db";
import type { IAutoModeLoop } from "@autoboard/shared";
import { ValidationError, NotFoundError } from "@autoboard/shared";

export interface DeleteProjectInput {
  id: string;
}

export interface DeleteProjectResult {
  success: boolean;
}

export class DeleteProjectUseCase {
  constructor(
    private projectRepository: ProjectRepository,
    private autoModeSettingsRepository?: AutoModeSettingsRepository,
    private autoModeLoop?: IAutoModeLoop
  ) {}

  async execute(input: DeleteProjectInput): Promise<DeleteProjectResult> {
    if (!input.id) throw new ValidationError("Project ID is required");

    const existingProject = await this.projectRepository.getProjectById(input.id);
    if (!existingProject) throw new NotFoundError("Project not found");

    if (this.autoModeLoop) this.autoModeLoop.stopLoop(input.id);
    if (this.autoModeSettingsRepository) {
      await this.autoModeSettingsRepository.deleteByProjectId(input.id);
    }

    await this.projectRepository.deleteCardsByProjectId(input.id);
    await this.projectRepository.deleteProject(input.id);
    return { success: true };
  }
}

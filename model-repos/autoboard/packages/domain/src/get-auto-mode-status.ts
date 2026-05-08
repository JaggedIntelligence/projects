import type { AutoModeSettingsRepository } from "@autoboard/db";
import type { IAutoModeLoop } from "@autoboard/shared";
import { ValidationError } from "@autoboard/shared";

export interface GetAutoModeStatusInput {
  projectId: string;
}

export interface GetAutoModeStatusResult {
  projectId: string;
  enabled: boolean;
  maxConcurrency: number;
  loopRunning: boolean;
  activeRunCount: number;
  activeCardIds: string[];
}

export class GetAutoModeStatusUseCase {
  constructor(
    private autoModeSettingsRepository: AutoModeSettingsRepository,
    private autoModeLoop: IAutoModeLoop
  ) {}

  async execute(input: GetAutoModeStatusInput): Promise<GetAutoModeStatusResult> {
    if (!input.projectId) throw new ValidationError("projectId is required");

    const settings = await this.autoModeSettingsRepository.getByProjectId(input.projectId);
    const loopStatus = this.autoModeLoop.getStatus(input.projectId);

    return {
      projectId: input.projectId,
      enabled: settings?.enabled ?? false,
      maxConcurrency: settings?.maxConcurrency ?? 1,
      loopRunning: loopStatus.loopRunning,
      activeRunCount: loopStatus.activeRunCount,
      activeCardIds: loopStatus.activeCardIds,
    };
  }
}

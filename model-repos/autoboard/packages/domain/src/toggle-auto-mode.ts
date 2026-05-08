import type { AutoModeSettingsRepository } from "@autoboard/db";
import type { IAutoModeLoop } from "@autoboard/shared";
import { ValidationError } from "@autoboard/shared";

export interface ToggleAutoModeInput {
  projectId: string;
  enabled: boolean;
}

export interface ToggleAutoModeResult {
  projectId: string;
  enabled: boolean;
}

export class ToggleAutoModeUseCase {
  constructor(
    private autoModeSettingsRepository: AutoModeSettingsRepository,
    private autoModeLoop: IAutoModeLoop
  ) {}

  async execute(input: ToggleAutoModeInput): Promise<ToggleAutoModeResult> {
    if (!input.projectId) throw new ValidationError("projectId is required");

    await this.autoModeSettingsRepository.upsert(input.projectId, {
      enabled: input.enabled,
      updatedAt: new Date(),
    });

    if (input.enabled) {
      this.autoModeLoop.startLoop(input.projectId);
    } else {
      this.autoModeLoop.stopLoop(input.projectId);
    }
    return { projectId: input.projectId, enabled: input.enabled };
  }
}

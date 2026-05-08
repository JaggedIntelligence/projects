import type { Context } from "hono";
import {
  GetAutoModeStatusUseCase,
  ToggleAutoModeUseCase,
  SetAutoModeConcurrencyUseCase,
} from "@autoboard/domain";
import type { AutoModeSettingsRepository } from "@autoboard/db";
import type { IAutoModeLoop } from "@autoboard/shared";
import { handleDomainError } from "../error-handler.js";

export function createAutoModeController(
  autoModeSettingsRepository: AutoModeSettingsRepository,
  autoModeLoop: IAutoModeLoop & { ensureInitialized?(): Promise<void> }
) {
  const getStatus = new GetAutoModeStatusUseCase(
    autoModeSettingsRepository,
    autoModeLoop
  );
  const toggle = new ToggleAutoModeUseCase(
    autoModeSettingsRepository,
    autoModeLoop
  );
  const setConcurrency = new SetAutoModeConcurrencyUseCase(
    autoModeSettingsRepository
  );

  return {
    async get(c: Context) {
      try {
        await autoModeLoop.ensureInitialized?.();
        const url = new URL(c.req.url);
        const projectId = url.searchParams.get("projectId");
        if (!projectId) {
          return c.json({ error: "projectId is required" }, 400);
        }
        const result = await getStatus.execute({ projectId });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async post(c: Context) {
      try {
        await autoModeLoop.ensureInitialized?.();
        const body = await c.req.json();
        const { projectId, enabled } = body;
        const result = await toggle.execute({ projectId, enabled });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },

    async patch(c: Context) {
      try {
        await autoModeLoop.ensureInitialized?.();
        const body = await c.req.json();
        const { projectId, maxConcurrency } = body;
        const result = await setConcurrency.execute({ projectId, maxConcurrency });
        return c.json(result);
      } catch (error) {
        return handleDomainError(error, c);
      }
    },
  };
}

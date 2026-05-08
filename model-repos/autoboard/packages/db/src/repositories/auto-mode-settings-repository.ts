import { db } from "../client.js";
import { autoModeSettings } from "../schema.js";
import { eq } from "drizzle-orm";
import type { AutoModeSettings, UpdateAutoModeData } from "../types.js";

export class AutoModeSettingsRepository {
  async getByProjectId(projectId: string): Promise<AutoModeSettings | null> {
    const results = await db
      .select()
      .from(autoModeSettings)
      .where(eq(autoModeSettings.projectId, projectId))
      .limit(1);
    if (results.length === 0) return null;
    return this.mapToDomain(results[0]);
  }

  async upsert(projectId: string, updates: UpdateAutoModeData): Promise<AutoModeSettings> {
    const results = await db
      .insert(autoModeSettings)
      .values({
        projectId,
        enabled: updates.enabled ?? false,
        maxConcurrency: updates.maxConcurrency ?? 1,
        updatedAt: updates.updatedAt,
      })
      .onConflictDoUpdate({
        target: autoModeSettings.projectId,
        set: {
          ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          ...(updates.maxConcurrency !== undefined && { maxConcurrency: updates.maxConcurrency }),
          updatedAt: updates.updatedAt,
        },
      })
      .returning();
    return this.mapToDomain(results[0]);
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await db.delete(autoModeSettings).where(eq(autoModeSettings.projectId, projectId));
  }

  async getAllEnabled(): Promise<AutoModeSettings[]> {
    const results = await db
      .select()
      .from(autoModeSettings)
      .where(eq(autoModeSettings.enabled, true));
    return results.map(this.mapToDomain);
  }

  private mapToDomain(row: typeof autoModeSettings.$inferSelect): AutoModeSettings {
    return {
      projectId: row.projectId,
      enabled: row.enabled,
      maxConcurrency: row.maxConcurrency,
      updatedAt: row.updatedAt,
    };
  }
}

export const autoModeSettingsRepository = new AutoModeSettingsRepository();

import { db } from "../client.js";
import { projects, kanbanCards } from "../schema.js";
import { eq } from "drizzle-orm";
import type { Project, CreateProjectData, UpdateProjectData } from "../types.js";

export class ProjectRepository {
  async getAllProjects(): Promise<Project[]> {
    const results = await db.select().from(projects);
    return results.map(this.mapToDomain);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const results = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (results.length === 0) return null;
    return this.mapToDomain(results[0]);
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    const results = await db
      .insert(projects)
      .values({
        id: data.id,
        name: data.name,
        filePath: data.filePath,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .returning();
    return this.mapToDomain(results[0]);
  }

  async updateProject(id: string, updates: UpdateProjectData): Promise<Project> {
    const updateData: Partial<typeof projects.$inferInsert> = {
      updatedAt: updates.updatedAt,
    };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.filePath !== undefined) updateData.filePath = updates.filePath;

    const results = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    if (results.length === 0) throw new Error("Project not found");
    return this.mapToDomain(results[0]);
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async deleteCardsByProjectId(projectId: string): Promise<void> {
    await db.delete(kanbanCards).where(eq(kanbanCards.projectId, projectId));
  }

  private mapToDomain(row: typeof projects.$inferSelect): Project {
    return {
      id: row.id,
      name: row.name,
      filePath: row.filePath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const projectRepository = new ProjectRepository();

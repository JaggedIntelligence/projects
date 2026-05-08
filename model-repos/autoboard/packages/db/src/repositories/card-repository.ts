import { db } from "../client.js";
import { kanbanCards } from "../schema.js";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import type { Card, CreateCardData, UpdateCardData } from "../types.js";

export class CardRepository {
  async getAllCards(): Promise<Card[]> {
    const results = await db
      .select()
      .from(kanbanCards)
      .where(isNull(kanbanCards.archivedAt));
    return results.map(this.mapToDomain);
  }

  async getCardsByProjectId(projectId: string): Promise<Card[]> {
    const results = await db
      .select()
      .from(kanbanCards)
      .where(and(eq(kanbanCards.projectId, projectId), isNull(kanbanCards.archivedAt)));
    return results.map(this.mapToDomain);
  }

  async getArchivedCardsByProjectId(projectId: string): Promise<Card[]> {
    const results = await db
      .select()
      .from(kanbanCards)
      .where(and(eq(kanbanCards.projectId, projectId), isNotNull(kanbanCards.archivedAt)));
    return results.map(this.mapToDomain);
  }

  async getCardById(id: string): Promise<Card | null> {
    const results = await db
      .select()
      .from(kanbanCards)
      .where(eq(kanbanCards.id, id))
      .limit(1);
    if (results.length === 0) return null;
    return this.mapToDomain(results[0]);
  }

  async createCard(data: CreateCardData): Promise<Card> {
    const results = await db
      .insert(kanbanCards)
      .values({
        id: data.id,
        title: data.title,
        description: data.description,
        columnId: data.columnId,
        projectId: data.projectId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .returning();
    return this.mapToDomain(results[0]);
  }

  async updateCard(id: string, updates: UpdateCardData): Promise<Card> {
    const updateData: Partial<typeof kanbanCards.$inferInsert> = {
      updatedAt: updates.updatedAt,
    };
    if (updates.columnId !== undefined) updateData.columnId = updates.columnId;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.sessionId !== undefined) updateData.sessionId = updates.sessionId;
    if (updates.archivedAt !== undefined) updateData.archivedAt = updates.archivedAt;

    const results = await db
      .update(kanbanCards)
      .set(updateData)
      .where(eq(kanbanCards.id, id))
      .returning();
    if (results.length === 0) throw new Error("Card not found");
    return this.mapToDomain(results[0]);
  }

  async deleteCard(id: string): Promise<void> {
    await db.delete(kanbanCards).where(eq(kanbanCards.id, id));
  }

  private mapToDomain(row: typeof kanbanCards.$inferSelect): Card {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      columnId: row.columnId,
      projectId: row.projectId,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
    };
  }
}

export const cardRepository = new CardRepository();

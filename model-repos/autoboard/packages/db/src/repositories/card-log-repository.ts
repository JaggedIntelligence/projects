import { db } from "../client.js";
import { cardLogs } from "../schema.js";
import { eq, and, gt, asc } from "drizzle-orm";
import type { CardLog } from "../types.js";
import { randomUUID } from "crypto";

export class CardLogRepository {
  async createLog(data: {
    cardId: string;
    type: string;
    content: string;
    sequence: number;
  }): Promise<CardLog> {
    const results = await db
      .insert(cardLogs)
      .values({
        id: randomUUID(),
        cardId: data.cardId,
        type: data.type,
        content: data.content,
        sequence: data.sequence,
        createdAt: new Date(),
      })
      .returning();
    return this.mapToDomain(results[0]);
  }

  async getLogsByCardId(cardId: string): Promise<CardLog[]> {
    const results = await db
      .select()
      .from(cardLogs)
      .where(eq(cardLogs.cardId, cardId))
      .orderBy(asc(cardLogs.sequence));
    return results.map(this.mapToDomain);
  }

  async getLogsAfterSequence(cardId: string, afterSequence: number): Promise<CardLog[]> {
    const results = await db
      .select()
      .from(cardLogs)
      .where(and(eq(cardLogs.cardId, cardId), gt(cardLogs.sequence, afterSequence)))
      .orderBy(asc(cardLogs.sequence));
    return results.map(this.mapToDomain);
  }

  async deleteLogsByCardId(cardId: string): Promise<void> {
    await db.delete(cardLogs).where(eq(cardLogs.cardId, cardId));
  }

  private mapToDomain(row: typeof cardLogs.$inferSelect): CardLog {
    return {
      id: row.id,
      cardId: row.cardId,
      type: row.type as CardLog["type"],
      content: row.content,
      sequence: row.sequence,
      createdAt: row.createdAt,
    };
  }
}

export const cardLogRepository = new CardLogRepository();

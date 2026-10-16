import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../../db/server';
import { knowledgebase } from '../../../db/schema';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const validId = (value: string | undefined) => {
  const id = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = validId(params.id);
  if (id === null) return json({ error: 'Invalid knowledgebase entry ID.' }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'Invalid knowledgebase update.' }, 400);
  }
  const input = body as Record<string, unknown>;

  const update: Partial<typeof knowledgebase.$inferInsert> = {};
  for (const field of ['catlevel1', 'url1'] as const) {
    if (field in input) {
      const value = input[field];
      if (typeof value !== 'string' || !value.trim()) {
        return json({ error: `${field} must be non-empty text.` }, 400);
      }
      update[field] = value.trim();
    }
  }
  for (const field of ['catlevel2', 'url2', 'note1', 'note2'] as const) {
    if (field in input) {
      const value = input[field];
      if (value !== null && typeof value !== 'string') {
        return json({ error: `${field} must be text or null.` }, 400);
      }
      update[field] = typeof value === 'string' ? value.trim() : null;
    }
  }
  if (Object.keys(update).length === 0) {
    return json({ error: 'No knowledgebase changes provided.' }, 400);
  }
  update.updatedAt = new Date();

  try {
    const db = await getDatabase();
    const [entry] = await db.update(knowledgebase).set(update).where(eq(knowledgebase.id, id)).returning();
    return entry ? json(entry) : json({ error: 'Knowledgebase entry not found.' }, 404);
  } catch (error) {
    console.error('Could not update knowledgebase entry:', error);
    return json({ error: 'Could not update knowledgebase entry.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = validId(params.id);
  if (id === null) return json({ error: 'Invalid knowledgebase entry ID.' }, 400);

  try {
    const db = await getDatabase();
    const [deleted] = await db.delete(knowledgebase).where(eq(knowledgebase.id, id)).returning({ id: knowledgebase.id });
    return deleted ? json(deleted) : json({ error: 'Knowledgebase entry not found.' }, 404);
  } catch (error) {
    console.error('Could not delete knowledgebase entry:', error);
    return json({ error: 'Could not delete knowledgebase entry.' }, 500);
  }
};

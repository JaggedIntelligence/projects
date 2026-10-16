import type { APIRoute } from 'astro';
import { desc } from 'drizzle-orm';
import { getDatabase } from '../../../db/server';
import { knowledgebase } from '../../../db/schema';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const optionalText = (body: Record<string, unknown>, field: string) => {
  const value = body[field];
  return value === undefined || value === null ? null : typeof value === 'string' ? value.trim() : undefined;
};

export const GET: APIRoute = async () => {
  try {
    const db = await getDatabase();
    return json(await db.select().from(knowledgebase).orderBy(desc(knowledgebase.createdAt), desc(knowledgebase.id)));
  } catch (error) {
    console.error('Could not list knowledgebase entries:', error);
    return json({ error: 'Could not load knowledgebase entries.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'Invalid knowledgebase entry.' }, 400);
  }
  const input = body as Record<string, unknown>;

  const catlevel1 = typeof input.catlevel1 === 'string' ? input.catlevel1.trim() : '';
  const url1 = typeof input.url1 === 'string' ? input.url1.trim() : '';
  if (!catlevel1 || !url1) {
    return json({ error: 'catlevel1 and url1 are required.' }, 400);
  }

  const catlevel2 = optionalText(input, 'catlevel2');
  const url2 = optionalText(input, 'url2');
  const note1 = optionalText(input, 'note1');
  const note2 = optionalText(input, 'note2');
  if ([catlevel2, url2, note1, note2].some((value) => value === undefined)) {
    return json({ error: 'Optional fields must be text or null.' }, 400);
  }

  try {
    const db = await getDatabase();
    const [entry] = await db.insert(knowledgebase).values({ catlevel1, catlevel2, url1, url2, note1, note2 }).returning();
    return json(entry, 201);
  } catch (error) {
    console.error('Could not create knowledgebase entry:', error);
    return json({ error: 'Could not add knowledgebase entry.' }, 500);
  }
};

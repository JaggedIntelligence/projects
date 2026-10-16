import type { APIRoute } from 'astro';
import { desc } from 'drizzle-orm';
import { getDatabase } from '../../../db/server';
import { todos } from '../../../db/schema';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async () => {
  try {
    const db = await getDatabase();
    return json(await db.select().from(todos).orderBy(desc(todos.createdAt), desc(todos.id)));
  } catch (error) {
    console.error('Could not list todos:', error);
    return json({ error: 'Could not load tasks.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }

  const title = typeof body === 'object' && body !== null && 'title' in body && typeof body.title === 'string'
    ? body.title.trim()
    : '';
  if (!title || title.length > 200) {
    return json({ error: 'Task title must be 1 to 200 characters.' }, 400);
  }

  try {
    const db = await getDatabase();
    const [todo] = await db.insert(todos).values({ title }).returning();
    return json(todo, 201);
  } catch (error) {
    console.error('Could not create todo:', error);
    return json({ error: 'Could not add task.' }, 500);
  }
};

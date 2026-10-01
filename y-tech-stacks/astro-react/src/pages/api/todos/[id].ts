import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../../db/server';
import { todos } from '../../../db/schema';

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
  if (id === null) return json({ error: 'Invalid task ID.' }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'Invalid task update.' }, 400);
  }

  const update: { title?: string; completed?: boolean; updatedAt: Date } = { updatedAt: new Date() };
  if ('title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
      return json({ error: 'Task title must be 1 to 200 characters.' }, 400);
    }
    update.title = body.title.trim();
  }
  if ('completed' in body) {
    if (typeof body.completed !== 'boolean') return json({ error: 'Completed must be true or false.' }, 400);
    update.completed = body.completed;
  }
  if (update.title === undefined && update.completed === undefined) {
    return json({ error: 'No task changes provided.' }, 400);
  }

  try {
    const db = await getDatabase();
    const [todo] = await db.update(todos).set(update).where(eq(todos.id, id)).returning();
    return todo ? json(todo) : json({ error: 'Task not found.' }, 404);
  } catch (error) {
    console.error('Could not update todo:', error);
    return json({ error: 'Could not update task.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = validId(params.id);
  if (id === null) return json({ error: 'Invalid task ID.' }, 400);

  try {
    const db = await getDatabase();
    const [deleted] = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id });
    return deleted ? json(deleted) : json({ error: 'Task not found.' }, 404);
  } catch (error) {
    console.error('Could not delete todo:', error);
    return json({ error: 'Could not delete task.' }, 500);
  }
};

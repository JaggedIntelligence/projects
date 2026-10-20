import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../../../db/server';
import { images } from '../../../db/schema';
import { checkUser, finishDeletion, imageId, json, publicImage, USER_ID, validDescription, validName } from '../../../lib/images/server';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!checkUser(request)) return json({ error: 'Invalid image user.' }, 400);
  const id = imageId(params.id);
  if (!id) return json({ error: 'Invalid image ID.' }, 400);
  let input: unknown;
  try { input = await request.json(); }
  catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid update.' }, 400);
  const body = input as Record<string, unknown>;
  const update: Partial<typeof images.$inferInsert> = {};
  if ('fileName' in body) {
    const name = validName(body.fileName);
    if (!name) return json({ error: 'Name must be 1–180 characters.' }, 400);
    update.fileName = name;
  }
  if ('desc' in body) {
    const description = validDescription(body.desc);
    if (description === undefined) return json({ error: 'Description must be at most 2000 characters.' }, 400);
    update.desc = description;
  }
  if (!Object.keys(update).length) return json({ error: 'No changes provided.' }, 400);
  update.updatedAt = new Date();
  try {
    const db = await getDatabase();
    const [row] = await db.update(images).set(update).where(and(eq(images.id, id), eq(images.userId, USER_ID), eq(images.status, 'ready'))).returning();
    return row ? json(publicImage(row)) : json({ error: 'Image not found.' }, 404);
  } catch (error) {
    console.error('Could not update image:', error);
    return json({ error: 'Could not update image.' }, 500);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!checkUser(request)) return json({ error: 'Invalid image user.' }, 400);
  const id = imageId(params.id);
  if (!id) return json({ error: 'Invalid image ID.' }, 400);
  try {
    const db = await getDatabase();
    const [row] = await db.update(images).set({ status: 'deleting', updatedAt: new Date() }).where(and(eq(images.id, id), eq(images.userId, USER_ID))).returning();
    if (!row) return json({ error: 'Image not found.' }, 404);
    await finishDeletion(row);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Could not delete image:', error);
    return json({ error: 'Could not delete image. Refresh to retry cleanup.' }, 500);
  }
};

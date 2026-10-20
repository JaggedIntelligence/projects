import type { APIRoute } from 'astro';
import { and, desc, eq, ilike, lt, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../db/server';
import { images } from '../../../db/schema';
import { checkUser, deleteImage, inspectImage, json, MAX_IMAGE_BYTES, publicImage, putImage, retryDeletions, USER_ID, validDescription, validName } from '../../../lib/images/server';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!checkUser(request)) return json({ error: 'Invalid image user.' }, 400);
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 30 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return json({ error: 'Invalid page size.' }, 400);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length > 180) return json({ error: 'Search is too long.' }, 400);
  const rawCursor = url.searchParams.get('cursor');
  let cursor: { id: string; createdAt: Date } | null = null;
  if (rawCursor) {
    try {
      const parsed = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
      const createdAt = new Date(parsed.createdAt);
      if (typeof parsed.id !== 'string' || !Number.isFinite(createdAt.valueOf())) throw new Error();
      cursor = { id: parsed.id, createdAt };
    } catch { return json({ error: 'Invalid cursor.' }, 400); }
  }
  try {
    await retryDeletions();
    const db = await getDatabase();
    const conditions = [eq(images.userId, USER_ID), eq(images.status, 'ready')];
    if (q) conditions.push(ilike(images.fileName, `%${q.replace(/[\\%_]/g, '\\$&')}%`));
    if (cursor) conditions.push(or(lt(images.createdAt, cursor.createdAt), and(eq(images.createdAt, cursor.createdAt), lt(images.id, cursor.id)))!);
    const rows = await db.select().from(images).where(and(...conditions)).orderBy(desc(images.createdAt), desc(images.id)).limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return json({ items: page.map(publicImage), nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt })).toString('base64url') : null });
  } catch (error) {
    console.error('Could not list images:', error);
    return json({ error: 'Could not load images.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!checkUser(request)) return json({ error: 'Invalid image user.' }, 400);
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES + 1024 * 1024) return json({ error: 'Image exceeds 10 MiB.' }, 413);
  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ error: 'Invalid upload form.' }, 400); }
  const files = form.getAll('file');
  if (files.length !== 1 || !(files[0] instanceof File)) return json({ error: 'Upload exactly one file per request.' }, 400);
  const file = files[0];
  if (file.size > MAX_IMAGE_BYTES) return json({ error: 'Image exceeds 10 MiB.' }, 413);
  const fileName = validName(form.get('fileName') ?? file.name);
  const description = validDescription(form.get('desc'));
  if (!fileName || description === undefined) return json({ error: 'Invalid name or description.' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = inspectImage(file, bytes);
  if (!format) return json({ error: 'Use a valid JPEG, PNG, WebP, or GIF image.' }, 415);
  const id = randomUUID();
  const key = `images/${USER_ID}/${id}.${format.extension}`;
  const now = new Date();
  try {
    await putImage(key, bytes, format.type);
    try {
      const db = await getDatabase();
      const [row] = await db.insert(images).values({ id, userId: USER_ID, fileName, originalName: file.name, desc: description, r2Key: key, contentType: format.type, size: file.size, createdAt: now, updatedAt: now }).returning();
      return json(publicImage(row), 201);
    } catch (error) {
      try { await deleteImage(key); } catch (cleanupError) { console.error('Could not clean up uploaded R2 object:', key, cleanupError); }
      throw error;
    }
  } catch (error) {
    console.error('Could not upload image:', error);
    return json({ error: 'Could not upload image.' }, 500);
  }
};

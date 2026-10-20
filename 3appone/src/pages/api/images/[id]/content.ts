import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../../../../db/server';
import { images } from '../../../../db/schema';
import { getImage, imageId, json, USER_ID } from '../../../../lib/images/server';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = imageId(params.id);
  if (!id) return json({ error: 'Invalid image ID.' }, 400);
  try {
    const db = await getDatabase();
    const [row] = await db.select().from(images).where(and(eq(images.id, id), eq(images.userId, USER_ID), eq(images.status, 'ready'))).limit(1);
    if (!row) return json({ error: 'Image not found.' }, 404);
    const object = await getImage(row.r2Key);
    if (!object.Body) return json({ error: 'Image data is unavailable.' }, 502);
    const bytes = await object.Body.transformToByteArray();
    return new Response(Uint8Array.from(bytes).buffer, { headers: {
      'Content-Type': row.contentType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="image-${row.id}.${row.contentType.split('/')[1]}"`,
    } });
  } catch (error) {
    console.error('Could not read image:', error);
    return json({ error: 'Could not load image.' }, 502);
  }
};

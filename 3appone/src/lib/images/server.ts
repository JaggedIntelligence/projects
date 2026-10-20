import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../../db/server';
import { images } from '../../db/schema';

export const USER_ID = 'user1';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

let storage: { client: S3Client; bucket: string } | undefined;

function setting(name: string, astroValue: string | undefined) {
  return process.env[name] || astroValue;
}

function getStorage() {
  if (storage) return storage;
  const accountId = setting('R2_ACCOUNT_ID', import.meta.env.R2_ACCOUNT_ID);
  const endpoint = setting('R2_ENDPOINT_URL', import.meta.env.R2_ENDPOINT_URL) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const bucket = setting('R2_BUCKET_NAME', import.meta.env.R2_BUCKET_NAME);
  const accessKeyId = setting('R2_ACCESS_KEY_ID', import.meta.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = setting('R2_SECRET_ACCESS_KEY', import.meta.env.R2_SECRET_ACCESS_KEY);
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 configuration is incomplete.');
  }
  storage = {
    bucket,
    client: new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } }),
  };
  return storage;
}

export function checkUser(request: Request) {
  return request.headers.get('X-Image-User-Id') === USER_ID;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function imageId(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export function validName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name && name.length <= 180 ? name : null;
}

export function validDescription(value: unknown) {
  if (value === null || value === '') return null;
  return typeof value === 'string' && value.length <= 2000 ? value.trim() : undefined;
}

export function inspectImage(file: File, bytes: Uint8Array) {
  const type = file.type.toLowerCase() as keyof typeof imageTypes;
  const extension = imageTypes[type];
  if (!extension || file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
  const namedExtension = file.name.toLowerCase().split('.').at(-1);
  const allowedExtensions: Record<keyof typeof imageTypes, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
  };
  if (!allowedExtensions[type].includes(namedExtension ?? '')) return null;
  const matches = type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    : type === 'image/gif' ? new TextDecoder().decode(bytes.subarray(0, 6)) === 'GIF87a' || new TextDecoder().decode(bytes.subarray(0, 6)) === 'GIF89a'
    : bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP';
  return matches ? { type, extension } : null;
}

export async function putImage(key: string, bytes: Uint8Array, contentType: string) {
  const { client, bucket } = getStorage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
}

export async function getImage(key: string) {
  const { client, bucket } = getStorage();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteImage(key: string) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function publicImage(row: typeof images.$inferSelect) {
  const { r2Key: _key, status: _status, ...metadata } = row;
  return { ...metadata, contentUrl: `/api/images/${row.id}/content` };
}

export async function finishDeletion(row: typeof images.$inferSelect) {
  await deleteImage(row.r2Key);
  const db = await getDatabase();
  await db.delete(images).where(and(eq(images.id, row.id), eq(images.userId, USER_ID)));
}

export async function retryDeletions() {
  const db = await getDatabase();
  const pending = await db.select().from(images).where(and(eq(images.userId, USER_ID), eq(images.status, 'deleting'))).limit(10);
  for (const row of pending) {
    try { await finishDeletion(row); }
    catch (error) { console.error('Could not finish image deletion:', row.id, error); }
  }
}

import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = {
  bucketName: string;
  publicBaseUrl?: string;
};

let client: S3Client | null = null;

function getR2Config(): R2Config {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error("Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.");
  }

  return {
    bucketName: R2_BUCKET_NAME,
    publicBaseUrl: R2_PUBLIC_BASE_URL?.replace(/\/$/, "")
  };
}

export function getR2Client() {
  if (client) return client;

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Cloudflare R2 credentials are missing.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT_URL || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });

  return client;
}

export async function createUploadUrl(key: string, contentType: string) {
  const { bucketName } = getR2Config();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 10 });
}

export async function checkBucketAccess() {
  const { bucketName } = getR2Config();

  await getR2Client().send(
    new HeadBucketCommand({
      Bucket: bucketName
    })
  );

  return {
    bucketName
  };
}

export async function createViewUrl(key: string) {
  const { bucketName, publicBaseUrl } = getR2Config();

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 60 });
}

export async function getObjectText(key: string) {
  const { bucketName } = getR2Config();
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  );

  if (!response.Body) return "";

  return response.Body.transformToString();
}

export async function putObjectText(key: string, body: string, contentType = "application/json") {
  const { bucketName } = getR2Config();

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

export async function putObjectBytes(key: string, body: Uint8Array, contentType: string) {
  const { bucketName } = getR2Config();

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

export async function deleteObject(key: string) {
  const { bucketName } = getR2Config();

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  );
}

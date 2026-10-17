Implemented the Images CRUD feature with metadata-only rename.

**What changed**

- Added protected `/images` route: `app/(app)/images/page.tsx`
- Added upload/grid/rename UI in `components/images`
- Added R2 helpers: `server/storage/r2.ts`
- Added JSON metadata helpers: `server/images/image-metadata.ts`
- Added shared image key/name helpers: `server/images/image-utils.ts`
- Added tRPC image router: `server/api/routers/images.ts`
- Added server-side upload route: `app/api/images/upload/route.ts`
- Wired router/nav/protection through `server/api/root.ts`, `components/app-shell.tsx`, and `middleware.ts`
- Added R2 env vars to `.env.example`
- Installed `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- Updated the design doc with option 1: metadata-only rename

**Behavior**

- Authenticated users can open `/images`.
- Users can select and upload multiple images.
- Uploads now use the app route `app/api/images/upload/route.ts`.
- Image bytes go from the browser to the Next.js server, then from the server to Cloudflare R2.
- This avoids requiring R2 CORS for uploads during local development.
- Image metadata is stored as JSON at `metadata/{userId}/images.json`.
- Missing metadata JSON returns an empty image list instead of an error.
- Image files are stored under `images/{userId}/{imageId}-{safe-file-name}`.
- Rename changes only the image metadata `fileName`.
- Rename does not copy, move, or rename the underlying R2 object key.
- Delete removes the R2 object and removes the image entry from the metadata JSON.
- The Images page runs an authenticated R2 health check and displays the connected bucket name or the real backend error.

**Upload Flow**

Current flow:

```text
browser -> /api/images/upload -> Next.js server -> Cloudflare R2
```

This replaced the earlier presigned browser `PUT` flow:

```text
browser -> Cloudflare R2
```

The server-mediated upload flow is simpler for local development because the browser only talks to the Next.js app. R2 CORS is not needed unless the app is changed back to direct browser uploads.

The upload route:

- Requires Clerk auth.
- Accepts multipart form data under the `files` field.
- Validates image type, file size, and batch count.
- Writes image bytes to R2 with `putObjectBytes`.
- Updates `metadata/{userId}/images.json`.
- Returns JSON with uploaded image metadata.

**R2 Client Details**

`server/storage/r2.ts` uses Cloudflare R2's S3-compatible API.

Important implementation details:

- Uses `R2_ENDPOINT_URL` when provided.
- Falls back to `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
- Sets `forcePathStyle: true`.
- Creates signed read URLs when `R2_PUBLIC_BASE_URL` is empty.
- Uses `R2_PUBLIC_BASE_URL` only when a real public bucket/custom domain URL is configured.

**Environment Variables**

Add real values to `.env.local`:

```env
R2_ACCOUNT_ID="replace_me"
R2_ENDPOINT_URL="https://replace_me.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="replace_me"
R2_SECRET_ACCESS_KEY="replace_me"
R2_BUCKET_NAME="second-brain-images"
R2_PUBLIC_BASE_URL=""
```

`R2_ENDPOINT_URL` should be the S3 API endpoint for the actual bucket jurisdiction from Cloudflare R2. For some EU jurisdiction buckets this includes `.eu.` in the hostname, but this project was verified against the default endpoint for the configured bucket.

`R2_PUBLIC_BASE_URL` is optional. If present, image previews use that public base URL. If empty, the app creates signed read URLs. Do not set `R2_PUBLIC_BASE_URL` to the private S3 API endpoint.

**R2 CORS Requirement**

The current implementation does not require R2 CORS for uploads because the browser no longer uploads directly to R2.

If the app is changed back to presigned browser `PUT` URLs later, configure the R2 bucket CORS to allow browser uploads from local and production origins.

Required basics:

- Allow method: `PUT`
- Allow header: `Content-Type`
- Allow origin: local dev origin, for example `http://localhost:3001`
- Add production origin when deployed

**Verification**

- Targeted ESLint for the new/changed image files passes.
- `pnpm exec tsc --noEmit` still fails because of pre-existing TypeScript errors in `components/youtube/youtube-page.tsx`, not from the new image feature.
- R2 bucket access was verified with `HeadBucket`.
- Missing metadata was verified as `NoSuchKey` and is now handled as an empty list.
- The upload route compiles and returns `401` when unauthenticated, as expected.
- A clean dev server was started at `http://localhost:3011` for the latest test pass.

Here’s the design plan I’d use for your new **Images CRUD** area in Second Brain.

Small note: your docs folder is `1PROJECT-DOCS`, not `/1PROEJCT-DOCS`.

**Goal**

Add a protected route like:

```text
/images
```

where an authenticated user can:

- Upload multiple image files
- View uploaded images in a grid/list
- Rename image files
- Delete images
- Store image metadata in a JSON file for now
- Store actual image binaries in Cloudflare R2

**Recommended Architecture**

Use Cloudflare R2 for both:

1. Image files
2. Metadata JSON file

That is better than writing `images.json` to the Next.js filesystem, because local/serverless filesystem storage is not reliable once deployed.

Suggested R2 layout:

```text
images/{userId}/{imageId}-{safe-file-name}.jpg
metadata/{userId}/images.json
```

Example metadata JSON:

```json
[
  {
    "id": "uuid",
    "userId": "clerk-user-id",
    "fileName": "meeting-notes.png",
    "originalName": "IMG_1234.png",
    "r2Key": "images/user_123/uuid-meeting-notes.png",
    "contentType": "image/png",
    "size": 245001,
    "width": null,
    "height": null,
    "createdAt": "2026-05-30T10:00:00.000Z",
    "updatedAt": "2026-05-30T10:00:00.000Z"
  }
]
```

**Backend Design**

Add an R2 helper:

```text
server/storage/r2.ts
```

Use Cloudflare R2’s S3-compatible API with `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.

Environment variables:

```env
R2_ACCOUNT_ID=
R2_ENDPOINT_URL=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

`R2_ENDPOINT_URL` should point to the actual Cloudflare R2 S3 API endpoint for the bucket. `R2_PUBLIC_BASE_URL` is optional and should only be used for a real public/custom domain URL, not the private R2 S3 API endpoint. If `R2_PUBLIC_BASE_URL` is empty, the app should create signed read URLs for previews and open/view actions.

Add metadata helpers:

```text
server/images/image-metadata.ts
```

Responsibilities:

- Read `metadata/{userId}/images.json` from R2
- Return `[]` if it does not exist yet
- Write updated metadata JSON back to R2
- Keep all metadata user-scoped
- Treat a missing metadata JSON file as an empty image library

Add shared image filename/key helpers:

```text
server/images/image-utils.ts
```

Responsibilities:

- Sanitize uploaded and renamed file names
- Build stable R2 keys like `images/{userId}/{imageId}-{safe-file-name}`

Add a server upload route:

```text
app/api/images/upload/route.ts
```

Responsibilities:

- Require Clerk auth
- Accept multipart form uploads under the `files` field
- Validate MIME type, file size, and batch count
- Upload image bytes from the Next.js server to R2
- Append uploaded image details to `metadata/{userId}/images.json`

Add a tRPC router:

```text
server/api/routers/images.ts
```

Current primary procedures:

```text
images.health
images.list
images.rename
images.delete
images.getViewUrl
```

The codebase may keep `images.createUploadUrls` and `images.confirmUploads` as optional/legacy support for a future presigned direct-upload path, but the active UI should use `/api/images/upload`.

Current recommended upload flow:

```text
browser -> /api/images/upload -> Next.js server -> Cloudflare R2
```

1. Client selects multiple images.
2. Client posts a `FormData` payload to `/api/images/upload`.
3. Server validates file names, MIME types, sizes, and batch count.
4. Server uploads the image bytes to R2.
5. Server writes image metadata to `metadata/{userId}/images.json`.
6. Client invalidates `images.list` and refreshes the image grid.

This avoids sending large files through tRPC and avoids requiring R2 CORS for local development because the browser only talks to the Next.js app.

The earlier presigned browser `PUT` design can still be used later for very large files or high-throughput uploads, but it requires correct R2 CORS. The current implementation favors a simpler, more reliable CRUD flow.

**Rename Behavior**

There are two options:

1. Rename metadata only  
   Fastest and safest. The displayed filename changes, but the R2 object key remains the same.

2. Rename actual R2 object key  
   More literal, but requires:
   - Copy old object to new key
   - Delete old object
   - Update metadata JSON

Final decision: use option 1 and rename metadata only. The displayed filename changes in `metadata/{userId}/images.json`, while the R2 object key remains stable.

**Frontend Design**

Add route:

```text
app/(app)/images/page.tsx
```

Add components:

```text
components/images/image-page.tsx
components/images/image-uploader.tsx
components/images/image-grid.tsx
components/images/image-rename-dialog.tsx
```

Add navigation item in:

```text
components/app-shell.tsx
```

```ts
{ href: "/images", label: "Images" }
```

Page layout:

- Top toolbar: title, upload button
- Dropzone/multi-file picker
- R2 health status message showing connected bucket or backend error
- Upload queue with progress states
- Image grid with thumbnail, filename, size, created date
- Actions per image: rename, delete, open/view

**Validation**

Add Zod schemas in:

```text
lib/validators.ts
```

Suggested rules:

- Allow only `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Max file size, for example `10MB`
- Max batch count, for example `20`
- Sanitize file names
- Require authenticated `userId` on all procedures

**State Management**

Use React Query through tRPC for server state.

Use Zustand only for UI state if needed, for example:

```text
store/image-store.ts
```

Useful state:

- selected images
- upload progress
- active rename dialog image
- search/filter text, if you want it

**Testing Plan**

Add focused tests:

```text
tests/api/images-router.test.ts
tests/components/image-uploader.test.tsx
tests/components/image-grid.test.tsx
tests/e2e/images.spec.ts
```

Test cases:

- Lists empty state
- Rejects invalid file types
- Uploads multiple images through `/api/images/upload`
- Writes uploaded images into JSON metadata
- Treats missing `metadata/{userId}/images.json` as an empty list
- Renames image metadata only
- Deletes image object and metadata
- User A cannot access User B image metadata

**Implementation Order**

1. Add R2 dependency and env docs.
2. Build `server/storage/r2.ts`.
3. Build JSON metadata read/write helpers.
4. Build shared image key/name helpers.
5. Add `imagesRouter` and connect it in `server/api/root.ts`.
6. Add `/api/images/upload` for server-mediated uploads.
7. Add `/images` route and shell nav item.
8. Build upload UI and image grid.
9. Add metadata-only rename/delete flows.
10. Add tests.

Final design note: renamed files should update metadata only. The R2 object key remains stable for the life of the image record, while the user-facing `fileName` can change.

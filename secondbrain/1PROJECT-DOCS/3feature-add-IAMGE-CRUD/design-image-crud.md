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
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

Add metadata helpers:

```text
server/images/image-metadata.ts
```

Responsibilities:

- Read `metadata/{userId}/images.json` from R2
- Return `[]` if it does not exist yet
- Write updated metadata JSON back to R2
- Keep all metadata user-scoped

Add a tRPC router:

```text
server/api/routers/images.ts
```

Procedures:

```text
images.list
images.createUploadUrls
images.confirmUploads
images.rename
images.delete
images.getViewUrl
```

Recommended flow:

1. Client selects multiple images.
2. Client calls `images.createUploadUrls`.
3. Server validates file names, MIME types, sizes, and creates R2 object keys.
4. Server returns presigned PUT URLs.
5. Client uploads files directly to R2.
6. Client calls `images.confirmUploads`.
7. Server writes image metadata to `metadata/{userId}/images.json`.

This avoids sending large files through tRPC.

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
components/images/image-card.tsx
components/images/image-rename-dialog.tsx
components/images/image-delete-dialog.tsx
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
- Creates upload URLs for multiple images
- Confirms uploaded images into JSON metadata
- Renames image metadata/R2 key
- Deletes image object and metadata
- User A cannot access User B image metadata

**Implementation Order**

1. Add R2 dependency and env docs.
2. Build `server/storage/r2.ts`.
3. Build JSON metadata read/write helpers.
4. Add `imagesRouter` and connect it in `server/api/root.ts`.
5. Add `/images` route and shell nav item.
6. Build upload UI and image grid.
7. Add rename/delete flows.
8. Add tests.

The only design choice I’d decide before coding is whether renamed files should physically rename the R2 object key. My recommendation: yes, since that matches your wording, but keep the image `id` stable in JSON so the UI does not care when the key changes.

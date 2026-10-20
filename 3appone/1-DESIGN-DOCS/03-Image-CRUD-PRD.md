Here’s the Feature Requirement Document for  new **Images CRUD** feature  


**Goal**

Add a  route like:

```text
/images
```

where it allow:

- Upload multiple image files
- View uploaded images in a grid/list
- Rename image files
- Delete images
- Store image metadata PGlite table
- Store actual image binaries in Cloudflare R2

**Recommended Architecture**

Use Cloudflare R2 for both:

1. Image files
2. Metadata JSON file

Suggested R2 layout:

for Cloudflare R2 , I have the credentials stored in  in the the /2appone/.env , make a copy of it and place it whereever it it approriate ..

Example metadata for images table:

```json
[
  {
    "id": "uuid",
    "userId": "",  // empty for now always
    "fileName": "meeting-notes.png",
    "originalName": "IMG_1234.png",
    "desc" : "description of the image ...."
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
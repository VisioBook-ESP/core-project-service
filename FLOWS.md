# VisioBook Mobile App — Complete API Call Flows

## Base Configuration

```
Gateway URL:  https://api.visiobook.com  (Kong — port 8080)
Global prefix: /api/v1
Auth header:   Authorization: Bearer <jwt_access_token>
               → Kong validates JWT, extracts userId, forwards as X-User-Id
```

All authenticated requests go through Kong. The mobile app never talks directly to microservices.

---

## Flow 1 — Authentication (core-user-service)

> Not part of core-project-service, but required before any other flow.

```
┌─────────────┐         ┌──────────┐         ┌──────────────────┐
│  Mobile App │ ──────► │   Kong   │ ──────► │ core-user-service│
└─────────────┘         └──────────┘         └──────────────────┘
```

### 1a. Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "displayName": "Jean Dupont"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": { "id": "uuid", "email": "user@example.com", "displayName": "Jean Dupont" }
}
```

### 1b. Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "SecureP@ss123" }
```

### 1c. Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbG..." }
```

**Mobile stores:** `accessToken` (15 min TTL) + `refreshToken` (7 days TTL) in secure storage (Keychain / EncryptedSharedPreferences).

---

## Flow 2 — Import File & Create Project

> Upload file to storage, then create project with extracted text.

### Step 1: Upload file (support-storage-service)

```http
POST /api/v1/storage/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
metadata: { "type": "pdf", "originalName": "mon-livre.pdf" }
```

**Response (201):**
```json
{
  "fileId": "file_uuid",
  "fileUrl": "https://cdn.visiobook.com/files/file_uuid",
  "checksum": "sha256:abc123...",
  "extractedText": "Il etait une fois..."
}
```

### Step 2: Create project (core-project-service)

```http
POST /api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Mon Premier Livre",
  "sourceType": "file",
  "config": {},
  "content": {
    "text": "Il etait une fois...",
    "metadata": { "fileId": "file_uuid", "wordCount": 1500 }
  }
}
```

**Response (201):**
```json
{
  "id": "proj_uuid",
  "userId": "user_uuid",
  "title": "Mon Premier Livre",
  "status": "draft",
  "sourceType": "file",
  "config": {},
  "createdAt": "2026-03-26T10:00:00.000Z",
  "updatedAt": "2026-03-26T10:00:00.000Z"
}
```

---

## Flow 3 — OCR Scanner

> Camera capture → OCR → Create project with scanned text.

### Step 1: Upload captured image

```http
POST /api/v1/storage/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <camera_image.jpg>
metadata: { "type": "image", "transform": "ocr", "language": "fr" }
```

### Step 2: Get OCR result

```http
POST /api/v1/storage/transform
Authorization: Bearer <token>

{ "fileId": "file_uuid", "type": "ocr", "language": "fr" }
```

**Response (200):**
```json
{
  "extractedText": "Chapitre 1 — Le commencement...",
  "confidence": 0.95,
  "regions": [{ "text": "...", "bounds": { "x": 0, "y": 0, "w": 100, "h": 50 } }]
}
```

### Step 3: Create project with scanned text

```http
POST /api/v1/projects
Authorization: Bearer <token>

{
  "title": "Document Scanne",
  "sourceType": "scan",
  "content": {
    "text": "Chapitre 1 — Le commencement...",
    "metadata": { "ocrConfidence": 0.95, "fileId": "file_uuid" }
  }
}
```

---

## Flow 4 — Configuration

> User tweaks project settings before generation.

### 4a. Update project config

```http
PATCH /api/v1/projects/:projectId
Authorization: Bearer <token>

{
  "title": "Mon Livre — Revised",
  "config": {
    "style": "watercolor",
    "audio": { "voice": "fr-FR-Denise", "music": "ambient", "speed": 1.0 },
    "output": { "resolution": "1080p", "format": "mp4", "duration": "auto" }
  }
}
```

**Response (200):**
```json
{
  "id": "proj_uuid",
  "userId": "user_uuid",
  "title": "Mon Livre — Revised",
  "status": "draft",
  "sourceType": "file",
  "config": {
    "style": "watercolor",
    "audio": { "voice": "fr-FR-Denise", "music": "ambient", "speed": 1.0 },
    "output": { "resolution": "1080p", "format": "mp4", "duration": "auto" }
  },
  "createdAt": "2026-03-26T10:00:00.000Z",
  "updatedAt": "2026-03-26T10:05:00.000Z"
}
```

### 4b. Edit content text (optional)

```http
PATCH /api/v1/projects/:projectId/content
Authorization: Bearer <token>

{
  "text": "Il etait une fois, dans un royaume lointain..."
}
```

**Response (200):**
```json
{
  "id": "content_uuid",
  "projectId": "proj_uuid",
  "text": "Il etait une fois, dans un royaume lointain...",
  "wordCount": 1523,
  "summary": null,
  "metadata": {}
}
```

### 4c. Edit a scene (after analysis)

```http
PATCH /api/v1/projects/:projectId/content/scenes/:sceneId
Authorization: Bearer <token>

{
  "text": "Le heros se tenait devant la porte...",
  "imagePrompt": "A hero standing before a grand wooden door in watercolor style"
}
```

**Response (200):**
```json
{
  "id": "scene_uuid",
  "projectId": "proj_uuid",
  "order": 3,
  "text": "Le heros se tenait devant la porte...",
  "description": "The hero faces the door",
  "imagePrompt": "A hero standing before a grand wooden door in watercolor style",
  "generatedImageUrl": null,
  "duration": 8.5,
  "sentiment": "suspense"
}
```

---

## Flow 5 — Generation (Full Pipeline)

> The most complex flow. Involves version creation, workflow start, real-time progress tracking.

### Step 1: Create a version

```http
POST /api/v1/projects/:projectId/versions
Authorization: Bearer <token>

{ "config": { "style": "watercolor", "audio": { "voice": "fr-FR-Denise" } } }
```

**Response (201):**
```json
{
  "id": "version_uuid",
  "projectId": "proj_uuid",
  "versionNumber": 1,
  "config": { "style": "watercolor", "audio": { "voice": "fr-FR-Denise" } },
  "status": "draft",
  "videoUrl": null,
  "createdAt": "2026-03-26T10:10:00.000Z"
}
```

### Step 2: Start workflow

```http
POST /api/v1/projects/:projectId/versions/:versionId/workflow/start
Authorization: Bearer <token>

{ "correlationId": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response (201):**
```json
{
  "executionId": "exec_uuid",
  "versionId": "version_uuid",
  "status": "pending",
  "currentStep": null,
  "progress": 0,
  "steps": [
    { "step": "analysis", "status": "pending", "progress": 0, "startedAt": null, "completedAt": null },
    { "step": "image_generation", "status": "pending", "progress": 0, "startedAt": null, "completedAt": null },
    { "step": "audio_generation", "status": "pending", "progress": 0, "startedAt": null, "completedAt": null },
    { "step": "assembly", "status": "pending", "progress": 0, "startedAt": null, "completedAt": null }
  ],
  "startedAt": null,
  "completedAt": null
}
```

### Step 3a: Track progress via SSE (preferred)

```http
GET /api/v1/projects/:projectId/versions/:versionId/workflow/progress/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

**Event stream:**
```
data: {"executionId":"exec_uuid","status":"running","currentStep":"analysis","progress":10,"steps":[{"step":"analysis","status":"running","progress":50},{"step":"image_generation","status":"pending","progress":0},{"step":"audio_generation","status":"pending","progress":0},{"step":"assembly","status":"pending","progress":0}]}

data: {"executionId":"exec_uuid","status":"running","currentStep":"image_generation","progress":35,"steps":[{"step":"analysis","status":"completed","progress":100},{"step":"image_generation","status":"running","progress":40},{"step":"audio_generation","status":"pending","progress":0},{"step":"assembly","status":"pending","progress":0}]}

data: {"executionId":"exec_uuid","status":"running","currentStep":"audio_generation","progress":65,"steps":[{"step":"analysis","status":"completed","progress":100},{"step":"image_generation","status":"completed","progress":100},{"step":"audio_generation","status":"running","progress":50},{"step":"assembly","status":"pending","progress":0}]}

data: {"executionId":"exec_uuid","status":"completed","currentStep":null,"progress":100,"steps":[{"step":"analysis","status":"completed","progress":100},{"step":"image_generation","status":"completed","progress":100},{"step":"audio_generation","status":"completed","progress":100},{"step":"assembly","status":"completed","progress":100}]}
```

Stream closes automatically when status reaches `completed`, `failed`, or `cancelled`.

### Step 3b: Track progress via polling (fallback)

```http
GET /api/v1/projects/:projectId/versions/:versionId/workflow/status/:executionId
Authorization: Bearer <token>
```

**Response (200):** Same shape as workflow status above. Poll every 3-5 seconds.

### Step 4 (if failed): Retry

```http
POST /api/v1/projects/:projectId/versions/:versionId/workflow/retry/:executionId
Authorization: Bearer <token>
```

**Response (202):** New execution created, returns new `executionId`.

### Step 4 (if user cancels): Cancel

```http
POST /api/v1/projects/:projectId/versions/:versionId/workflow/cancel/:executionId
Authorization: Bearer <token>
```

**Response (200):** Execution status set to `cancelled`.

### Backend pipeline (invisible to mobile):

```
  XState v5 state machine transitions:
  ┌───────┐    START     ┌───────────┐   DONE   ┌──────────┐   START    ┌────────────┐
  │ draft │ ──────────► │ analyzing │ ───────► │ analyzed │ ────────► │ generating │
  └───────┘              └───────────┘          └──────────┘           └────────────┘
                              │                                        │ ┌──────────┐
                              │ FAIL                                   ├►│  images  │
                              ▼                                        │ └──────────┘
                         ┌────────┐                                    │ ┌──────────┐
                         │ failed │◄───────────────────────────────────├►│  audio   │
                         └────────┘                                    │ └──────────┘
                                                                       │ ┌──────────┐
                              ┌───────────┐   DONE                     └►│ assembly │
                              │ cancelled │◄─── CANCEL at any step       └──────┬───┘
                              └───────────┘                                     │
                                                                                ▼
                                                                          ┌───────────┐
                                                                          │ completed │
                                                                          └───────────┘

  NATS JetStream events published at each transition.
  BullMQ jobs execute each step with retries.
```

---

## Flow 6 — Player (Video Playback)

> After generation completes, fetch the version to get `videoUrl`.

### Get completed version

```http
GET /api/v1/projects/:projectId/versions/:versionId
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "version_uuid",
  "projectId": "proj_uuid",
  "versionNumber": 1,
  "config": { "style": "watercolor" },
  "status": "completed",
  "videoUrl": "https://cdn.visiobook.com/videos/version_uuid.mp4",
  "createdAt": "2026-03-26T10:10:00.000Z",
  "executions": [...]
}
```

### Stream video (support-storage-service)

```http
GET /api/v1/storage/stream/:fileId
Authorization: Bearer <token>
Range: bytes=0-1048575

→ 206 Partial Content
Content-Range: bytes 0-1048575/5242880
Content-Type: video/mp4
```

### Get scenes for chapter navigation

```http
GET /api/v1/projects/:projectId/content/scenes
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "scene_1_uuid",
    "projectId": "proj_uuid",
    "order": 1,
    "text": "Il etait une fois...",
    "description": "Once upon a time in a faraway land",
    "imagePrompt": "A mystical kingdom at dawn, watercolor style",
    "generatedImageUrl": "https://cdn.visiobook.com/images/scene1.png",
    "duration": 6.5,
    "sentiment": "wonder"
  },
  {
    "id": "scene_2_uuid",
    "projectId": "proj_uuid",
    "order": 2,
    "text": "Le heros marchait...",
    "description": "The hero walks through the forest",
    "imagePrompt": "A hero walking in a dense forest, watercolor",
    "generatedImageUrl": "https://cdn.visiobook.com/images/scene2.png",
    "duration": 8.0,
    "sentiment": "adventure"
  }
]
```

### Get characters

```http
GET /api/v1/projects/:projectId/content/characters
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "char_uuid",
    "projectId": "proj_uuid",
    "name": "Arthus",
    "description": "A young boy with curious eyes and a red scarf",
    "aliases": ["le heros", "le garcon"],
    "traits": ["brave", "curious", "kind"]
  }
]
```

---

## Flow 7 — Export & Share

### 7a. Create share link

```http
POST /api/v1/projects/:projectId/share
Authorization: Bearer <token>

{
  "expiresAt": "2026-04-26T00:00:00.000Z",
  "allowDownload": true,
  "password": "MySecret123"
}
```

**Response (201):**
```json
{
  "id": "share_uuid",
  "projectId": "proj_uuid",
  "shareToken": "abc123def456",
  "expiresAt": "2026-04-26T00:00:00.000Z",
  "allowDownload": true,
  "isPasswordProtected": true,
  "createdAt": "2026-03-26T10:30:00.000Z"
}
```

Mobile constructs shareable URL: `https://visiobook.com/shared/abc123def456`

### 7b. Get share link info

```http
GET /api/v1/projects/:projectId/share
Authorization: Bearer <token>
```

### 7c. Delete share link

```http
DELETE /api/v1/projects/:projectId/share
Authorization: Bearer <token>
→ 204 No Content
```

### 7d. Access shared project (public, no auth)

```http
GET /api/v1/shared/abc123def456
```

**Response (200):**
```json
{
  "title": "Mon Premier Livre",
  "videoUrl": null,
  "allowDownload": true,
  "requiresPassword": true,
  "createdAt": "2026-03-26T10:00:00.000Z"
}
```

If `requiresPassword: true`, mobile shows password prompt. `videoUrl` is `null` until password verified.

### 7e. Verify password (public, no auth)

```http
POST /api/v1/shared/abc123def456/verify

{ "password": "MySecret123" }
```

**Response (200):**
```json
{
  "title": "Mon Premier Livre",
  "videoUrl": "https://cdn.visiobook.com/videos/version_uuid.mp4",
  "allowDownload": true,
  "requiresPassword": false,
  "createdAt": "2026-03-26T10:00:00.000Z"
}
```

---

## Flow 8 — History & Versions

### 8a. List projects (paginated)

```http
GET /api/v1/projects?page=1&pageSize=20&sortBy=updatedAt&sortOrder=desc&status=active
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "proj_uuid",
      "userId": "user_uuid",
      "title": "Mon Premier Livre",
      "status": "active",
      "sourceType": "file",
      "config": { "style": "watercolor" },
      "createdAt": "2026-03-26T10:00:00.000Z",
      "updatedAt": "2026-03-26T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "pages": 3
  }
}
```

### 8b. Search projects

```http
GET /api/v1/projects/search?q=heros&page=1&pageSize=20&status=active
Authorization: Bearer <token>
```

### 8c. Get project detail

```http
GET /api/v1/projects/:projectId
Authorization: Bearer <token>
```

### 8d. List versions for a project

```http
GET /api/v1/projects/:projectId/versions
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": "v1_uuid",
    "projectId": "proj_uuid",
    "versionNumber": 1,
    "config": { "style": "watercolor" },
    "status": "completed",
    "videoUrl": "https://cdn.visiobook.com/videos/v1.mp4",
    "createdAt": "2026-03-26T10:10:00.000Z"
  },
  {
    "id": "v2_uuid",
    "projectId": "proj_uuid",
    "versionNumber": 2,
    "config": { "style": "manga" },
    "status": "completed",
    "videoUrl": "https://cdn.visiobook.com/videos/v2.mp4",
    "createdAt": "2026-03-26T14:00:00.000Z"
  }
]
```

### 8e. Compare two versions

```http
GET /api/v1/projects/:projectId/versions/:v1/compare/:v2
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "version1": {
    "id": "v1_uuid",
    "versionNumber": 1,
    "status": "completed",
    "config": { "style": "watercolor" },
    "videoUrl": "https://cdn.visiobook.com/videos/v1.mp4",
    "createdAt": "2026-03-26T10:10:00.000Z"
  },
  "version2": {
    "id": "v2_uuid",
    "versionNumber": 2,
    "status": "completed",
    "config": { "style": "manga" },
    "videoUrl": "https://cdn.visiobook.com/videos/v2.mp4",
    "createdAt": "2026-03-26T14:00:00.000Z"
  },
  "configDiff": {
    "added": {},
    "removed": {},
    "changed": {
      "style": { "from": "watercolor", "to": "manga" }
    }
  }
}
```

### 8f. Revert to a previous version

```http
POST /api/v1/projects/:projectId/versions/:versionId/revert
Authorization: Bearer <token>
```

**Response (201):** Returns a new version (versionNumber = max+1) with the same config as the reverted version.

### 8g. Archive a project

```http
POST /api/v1/projects/:projectId/archive
Authorization: Bearer <token>
```

**Response (200):** Project with `status: "archived"`.

### 8h. Delete a project (soft-delete)

```http
DELETE /api/v1/projects/:projectId
Authorization: Bearer <token>
→ 204 No Content
```

---

## Content Endpoints (Read & Edit)

### Get full content

```http
GET /api/v1/projects/:projectId/content
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "content_uuid",
  "projectId": "proj_uuid",
  "text": "Il etait une fois...",
  "wordCount": 1500,
  "summary": "A young hero embarks on a quest through a mystical kingdom...",
  "metadata": { "fileId": "file_uuid", "language": "fr" }
}
```

### Get content summary

```http
GET /api/v1/projects/:projectId/content/summary
Authorization: Bearer <token>
```

---

## Error Handling (All Endpoints)

### Standard error format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "path": ["title"], "message": "String must contain at least 1 character(s)" }
  ]
}
```

### Common HTTP errors

| Code | Meaning | Mobile Action |
|------|---------|---------------|
| 400 | Validation failed | Show field-level errors |
| 401 | Token expired/invalid | Trigger refresh token flow, retry |
| 404 | Not found (or not owned) | Show "not found" screen |
| 409 | Conflict (workflow already running) | Show "already in progress" toast |
| 429 | Rate limited | Back off, show retry countdown |
| 503 | Service unavailable | Show offline/retry screen |

---

## Mobile Implementation Notes

### Token refresh interceptor (pseudo-code)

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { accessToken } = await refreshToken();
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

### SSE connection with auto-reconnect

```typescript
const eventSource = new EventSource(
  `${BASE_URL}/api/v1/projects/${projectId}/versions/${versionId}/workflow/progress/stream`,
  { headers: { Authorization: `Bearer ${token}` } }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateProgressUI(data.progress, data.currentStep, data.steps);
  if (['completed', 'failed', 'cancelled'].includes(data.status)) {
    eventSource.close();
    handleWorkflowEnd(data.status);
  }
};

eventSource.onerror = () => {
  // Fallback to polling
  eventSource.close();
  startPolling(projectId, versionId, executionId);
};
```

### Recommended polling strategy

```
Interval:  3 seconds while status is "running"
Max polls: 600 (= 30 min timeout)
Backoff:   After 10 consecutive identical responses, increase to 10 sec
Stop:      When status ∈ { completed, failed, cancelled }
```

# Core Project Service — API Routes

> Global prefix: `/api/v1`  
> Port: `8086`

---

## Health — `/api/v1/health`

| Method | Route              | Auth   | Description      |
|--------|--------------------|--------|------------------|
| GET    | `/health/ready`    | Public | Readiness probe  |
| GET    | `/health/live`     | Public | Liveness probe   |
| GET    | `/health/details`  | Public | Health details   |

## Metrics — `/api/v1/metrics`

| Method | Route      | Auth   | Description        |
|--------|------------|--------|--------------------|
| GET    | `/metrics` | Public | Prometheus metrics |

## Projects — `/api/v1/projects`

| Method | Route                  | Auth | Description              |
|--------|------------------------|------|--------------------------|
| POST   | `/projects`            | Yes  | Create a project         |
| GET    | `/projects`            | Yes  | List user projects       |
| GET    | `/projects/search`     | Yes  | Search projects          |
| GET    | `/projects/:id`        | Yes  | Get project details      |
| PATCH  | `/projects/:id`        | Yes  | Update a project         |
| POST   | `/projects/:id/archive`| Yes  | Archive a project        |
| DELETE | `/projects/:id`        | Yes  | Soft-delete a project    |

## Content — `/api/v1/projects/:projectId/content`

| Method | Route                        | Auth | Description          |
|--------|------------------------------|------|----------------------|
| GET    | `/content`                   | Yes  | Get content          |
| PATCH  | `/content`                   | Yes  | Update content       |
| GET    | `/content/scenes`            | Yes  | List scenes          |
| GET    | `/content/summary`           | Yes  | Content summary      |
| PATCH  | `/content/scenes/:sceneId`   | Yes  | Update a scene       |
| GET    | `/content/characters`        | Yes  | List characters      |

## Versions — `/api/v1/projects/:projectId/versions`

| Method | Route                        | Auth | Description            |
|--------|------------------------------|------|------------------------|
| POST   | `/versions`                  | Yes  | Create a version       |
| GET    | `/versions`                  | Yes  | List versions          |
| GET    | `/versions/:v1/compare/:v2`  | Yes  | Compare two versions   |
| GET    | `/versions/:versionId`       | Yes  | Get version details    |
| POST   | `/versions/:versionId/revert`| Yes  | Revert to a version    |

## Workflow — `/api/v1/projects/:projectId/versions/:versionId/workflow`

| Method | Route                          | Auth | Description             |
|--------|--------------------------------|------|-------------------------|
| POST   | `/workflow/start`              | Yes  | Start workflow           |
| GET    | `/workflow/status/:executionId`| Yes  | Get execution status     |
| POST   | `/workflow/cancel/:executionId`| Yes  | Cancel execution         |
| POST   | `/workflow/retry/:executionId` | Yes  | Retry failed execution   |
| GET    | `/workflow/progress/stream`    | Yes  | SSE real-time progress   |

## Share — `/api/v1/`

| Method | Route                          | Auth   | Description              |
|--------|--------------------------------|--------|--------------------------|
| POST   | `/projects/:projectId/share`   | Yes    | Create share link        |
| GET    | `/projects/:projectId/share`   | Yes    | List share links         |
| DELETE | `/projects/:projectId/share`   | Yes    | Delete share links       |
| GET    | `/shared/:token`               | Public | Access shared project    |
| POST   | `/shared/:token/verify`        | Public | Verify share password    |
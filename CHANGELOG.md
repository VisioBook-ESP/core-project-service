# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

#### E2E Tests (Tasks 3.18a-g)

- `test/e2e/setup.ts` — E2E bootstrap with testcontainers (PostgreSQL, Redis, NATS), process.env-based config, mocked external clients
- `test/helpers/auth.ts` — auth header helpers (TEST_USER_ID, OTHER_USER_ID, authHeaders)
- `test/helpers/seed.ts` — database seeding helpers (seedProject, seedProjectWithContent, seedVersion, seedExecution, seedShareLink, seedScenes, seedCharacters)
- `test/e2e/project.e2e.spec.ts` — 12 tests: create, validation, list, pagination, get, ownership 404, update, soft-delete, auth 401, search fulltext, search empty
- `test/e2e/content.e2e.spec.ts` — 8 tests: get content, ownership 404, update content, list scenes, update scene, summary, list characters, empty characters
- `test/e2e/version.e2e.spec.ts` — 6 tests: create version, auto-increment, list, get with executions, ownership 404 (GET/POST)
- `test/e2e/workflow.e2e.spec.ts` — 6 tests: start workflow, get status, cancel running, cancel non-running 409, retry failed, ownership 404
- `test/e2e/share.e2e.spec.ts` — 6 tests: create share link, create with expiry, access shared project, expired 404, invalid token 404, ownership 404
- Total: 38 E2E tests passing across 5 test files
- Added `unplugin-swc` and `@swc/core` dev dependencies for correct decorator metadata in Vitest E2E tests
- Added `.swcrc` config for SWC decorator metadata support
- Updated `vitest.workspace.ts` with SWC plugin for E2E project

### Fixed

- Fixed `ProjectService.search` — replaced `SELECT p.*` with explicit column list to avoid Prisma `UnsupportedNativeDataType` error on `tsvector` columns

#### Wave 14 Unit Tests (Tasks 3.19a-j)

- `test/unit/project/project-search.spec.ts` — ProjectService.search ($queryRaw, pagination, trim) + ProjectController feature flag (8 tests)
- `test/unit/content/content-summary.spec.ts` — ContentService.getSummary (summary, null, ownership) (4 tests)
- `test/unit/content/scene-update.spec.ts` — ContentService.updateScene (partial update, 404, ownership) (5 tests)
- `test/unit/content/characters.spec.ts` — ContentService.listCharacters (results, empty array, ownership) (3 tests)
- `test/unit/workflow/workflow-cancel.spec.ts` — WorkflowService.cancelWorkflow (DB updates, BullMQ removal, NATS event, SSE emit, 409 conflict) (8 tests)
- `test/unit/workflow/workflow-retry.spec.ts` — WorkflowService.retryWorkflow (new execution, skip completed, enqueue from failed, 409, max retries, version status) (8 tests)
- `test/unit/workflow/workflow-sse.spec.ts` — WorkflowSSEController (initial snapshot, feature flag, 404, ownership) (4 tests)
- `test/unit/share/share.service.spec.ts` — ShareService create/access (token, expiry, password-protected, deleted project) (9 tests)
- `test/unit/clients/notification-service.client.spec.ts` — NotificationServiceClient (POST, retries, best-effort no-throw, backoff) (5 tests)
- `test/unit/common/metrics.spec.ts` — MetricsService, MetricsInterceptor, MetricsController (counters, Prometheus format) (7 tests)
- Total: 261 unit tests passing across 28 test files

#### Swagger Documentation Verification (Wave 13, Tasks 3.14a-h)

- Added `@ApiTags('Health')`, `@ApiOperation`, and `@ApiResponse` decorators to `HealthController` (readiness, liveness, details endpoints)
- Added missing `@ApiResponse` decorator to `ProjectController.findAll`
- Verified all other controllers already have `@ApiTags`, `@ApiOperation`, and `@ApiResponse` decorators: Projects, Content, Versions, Workflow, Sharing
- Verified Swagger setup in `main.ts` with `DocumentBuilder`, `patchNestJsSwagger()`, and `SWAGGER_ENABLED` guard

## [0.3.0]

Phase 3 Wave 12 (Feature Extensions) — full-text search, share links, SSE streaming, workflow retry/cancel, notification client, Prometheus metrics, NATS hardening, graceful shutdown. 200 unit tests passing.

### Added

#### Full-Text Search (Wave 12, Tasks 3.1a-c)

- Prisma migration with tsvector columns + GIN indexes on Project.title and ProjectContent.text
- `search(userId, query, pagination)` in ProjectService using `$queryRaw` with `plainto_tsquery` + `ts_rank`
- `GET /search` endpoint in ProjectController guarded by `FEATURE_SEARCH_ENABLED`
- `src/project/dto/search-projects-query.dto.ts` — Zod schema (q, page, pageSize)

#### Content Extensions (Wave 12, Tasks 3.2-3.4)

- `getSummary(projectId, userId)` method + `GET /summary` endpoint in ContentService/Controller
- `src/content/dto/update-scene.dto.ts` — partial update Zod schema (at least one field required)
- `updateScene()` method + `PATCH /scenes/:sceneId` endpoint
- `src/content/dto/character-response.dto.ts` — Zod schema
- `listCharacters()` method + `GET /characters` endpoint

#### Share Module (Wave 12, Tasks 3.8-3.10)

- `src/share/` — complete new module with controller, service, DTOs
- Share link creation with `crypto.randomBytes(32).toString('base64url')` tokens
- Public access endpoint `GET /shared/:token` with `@Public()` decorator
- Expiration and password protection checks
- Guarded by `FEATURE_SHARE_ENABLED` config flag

#### Workflow Extensions (Wave 12, Tasks 3.5-3.7, 3.11)

- Enhanced `cancelWorkflow()` — BullMQ job removal, steps marked as `skipped`
- `retryWorkflow()` — new execution, skips completed steps, retries from failed step
- `src/workflow/workflow.sse.controller.ts` — SSE endpoint for real-time progress via EventEmitter2
- `src/clients/notification-service.client.ts` — best-effort notifications (retry 3x, no throw)
- Notifications on workflow complete/fail integrated into WorkflowService

#### NATS Hardening (Wave 12, Task 3.12)

- Zod validation schemas for all 7 inbound event types
- Idempotency checks (skip duplicate image.completed for same scene)
- Prisma transactions for analysis completed (scenes + characters atomically)
- Structured logging with `{ subject, executionId, correlationId }`
- Dead-letter handling for poison messages

#### Observability Infrastructure (Wave 12, Tasks 3.13a-c)

- `src/metrics/` — global module with MetricsService, MetricsController, MetricsInterceptor
- All prom-client metrics defined (HTTP, workflow, BullMQ, NATS, Prisma, SSE)
- `GET /metrics` public endpoint returning Prometheus exposition format
- HTTP request counting/timing interceptor registered globally

#### Correlation ID & Graceful Shutdown (Wave 12, Tasks 3.15-3.16)

- Verified X-Request-Id propagation across LoggingInterceptor, HTTP clients, NATS publisher
- NotificationServiceClient includes X-Request-Id header
- `onModuleDestroy()` in WorkflowProcessor (close BullMQ workers)
- Verified: app.enableShutdownHooks(), NATS drain, PrismaService.$disconnect()

#### Configuration

- Added `NOTIFICATION_SERVICE_URL` (required) and `STORAGE_SERVICE_URL` (optional) to app.config.ts
- Installed `@nestjs/event-emitter` for SSE EventEmitter2 pattern

---

## [0.2.0]

Phase 2 (Core MVP) — Waves 6-11 complete. All business logic modules, workflow engine, messaging, 204 unit tests and 15 integration tests passing.

### Added

#### Project DTOs (Wave 6, Tasks 2.1a-d)

- `src/project/dto/create-project.dto.ts` — Zod schema with title, sourceType, config, content
- `src/project/dto/update-project.dto.ts` — Partial update schema
- `src/project/dto/project-response.dto.ts` — Response schema with all project fields
- `src/project/dto/list-projects-query.dto.ts` — Paginated query with coercion and defaults

#### NATS Messaging & HTTP Clients (Wave 6, Tasks 2.14-2.19)

- `src/messaging/subjects.ts` — NATS subject constants and stream config
- `src/messaging/nats.publisher.ts` — JetStream publisher with 3x retry + exponential backoff
- `src/messaging/nats.subscriber.ts` — Durable consumer with explicit ack, wired to WorkflowService
- `src/messaging/messaging.module.ts` — NestJS module providing all messaging and client services
- `src/clients/user-service.client.ts` — Quota check/decrement with retry
- `src/clients/storage-service.client.ts` — Upload URL, delete, metadata with retry

#### Workflow Engine Foundation (Wave 6, Tasks 2.20, 2.23)

- `src/workflow/workflow.machine.ts` — XState v5 state machine (draft→analyzing→analyzed→generating→completed|failed|cancelled)
- `src/workflow/workflow.progress.ts` — Weighted progress calculation utility

#### Project Module (Wave 7, Tasks 2.2-2.5)

- `src/project/project.service.ts` — CRUD with ownership enforcement, soft-delete, NATS event publishing
- `src/project/project.controller.ts` — REST endpoints (POST, GET, GET/:id, PATCH/:id, DELETE/:id)
- `src/project/project.module.ts` — NestJS module

#### BullMQ Processor & Workflow Module (Wave 7, Tasks 2.21a-c)

- `src/workflow/workflow.types.ts` — Queue name, job names, job data interface
- `src/workflow/workflow.processor.ts` — BullMQ processor with job routing and NATS event publishing
- `src/workflow/workflow.module.ts` — Module with BullModule queue registration
- BullModule.forRootAsync() added to AppModule with Redis connection from config

#### Content Module (Wave 8, Tasks 2.6-2.9)

- `src/content/dto/update-content.dto.ts`, `content-response.dto.ts`, `scene-response.dto.ts`
- `src/content/content.service.ts` — Content CRUD with wordCount recompute, scene listing
- `src/content/content.controller.ts` — REST endpoints for content and scenes
- `src/content/content.module.ts`

#### Version Module (Wave 8, Tasks 2.10-2.13)

- `src/version/dto/create-version.dto.ts`, `version-response.dto.ts`
- `src/version/version.service.ts` — Version CRUD with auto-increment versionNumber
- `src/version/version.controller.ts` — REST endpoints for version management
- `src/version/version.module.ts`

#### Workflow Engine Assembly (Wave 9, Tasks 2.22-2.28)

- `src/workflow/dto/start-workflow.dto.ts`, `workflow-status-response.dto.ts`
- `src/workflow/workflow.service.ts` — Full orchestrator: startWorkflow, cancelWorkflow, getStatus, step handlers with XState validation and BullMQ job scheduling
- `src/workflow/workflow.controller.ts` — REST endpoints (start, status, cancel)
- NATS subscriber stubs replaced with real WorkflowService calls (circular dependency resolved via ModuleRef)

#### P1 Unit Tests (Wave 10)

- 10 new test files, 135 new tests (171 total with Phase 1)
- DTO validation tests for all 11 Zod schemas
- XState machine transition tests (17 tests covering all states and guards)
- Progress calculation tests (9 tests)
- Service tests for ProjectService, ContentService, VersionService, WorkflowService

#### P1 Unit Tests — Messaging & Clients (Wave 10, Tasks 2.27g-j)

- 4 new test files, 33 new tests (204 total unit tests)
- `test/unit/messaging/nats.publisher.spec.ts` — 10 tests: publish methods, retry logic, exponential backoff, connection drain
- `test/unit/messaging/nats.subscriber.spec.ts` — 10 tests: subject routing to WorkflowService, unknown subject handling, lifecycle
- `test/unit/clients/user-service.client.spec.ts` — 6 tests: checkQuota, decrementQuota, retry, ServiceUnavailableException
- `test/unit/clients/storage-service.client.spec.ts` — 7 tests: getUploadUrl, deleteFile, getFileMetadata, retry, headers

#### P1 Integration Tests (Wave 11, Tasks 2.28a-d)

- 4 new files, 15 integration tests using testcontainers (PostgreSQL 16, Redis 7, NATS 2.10)
- `test/integration/setup.ts` — Shared container lifecycle, Prisma migrations via raw SQL, `@prisma/adapter-pg` driver
- `test/integration/project/project.service.integration.spec.ts` — 6 tests: CRUD, userId isolation, soft-delete, pagination, unique constraints
- `test/integration/workflow/workflow.processor.integration.spec.ts` — 4 tests: BullMQ job processing, data passing, failure handling
- `test/integration/messaging/nats.integration.spec.ts` — 5 tests: JetStream pub/sub, ack/nak, durable consumers, stream config

## [0.1.0] — 2026-02-27

Phase 1 (Foundation) complete — all files created, lint/typecheck/36 unit tests passing.

### Added

#### Build & Tooling (Wave 1)

- TypeScript configuration (`tsconfig.json`, `tsconfig.eslint.json`) targeting ES2023 with NodeNext modules
- ESLint 9 flat config (`eslint.config.js`) with typescript-eslint and prettier
- Prettier config (`.prettierrc`)
- Vitest configuration (`vitest.config.ts`, `vitest.workspace.ts`) with unit/integration/e2e project workspaces
- Environment variable template (`.env.example`) with all documented variables
- Docker Compose dev environment (`docker-compose.dev.yml`) with PostgreSQL 16, Redis 7, NATS 2.10
- Updated `.gitignore` for build artifacts and generated files

#### Environment & CI/CD (Wave 2)

- Zod-validated environment configuration (`src/common/config/app.config.ts`) with fail-fast validation
- Custom global NestJS ConfigModule (`src/common/config/config.module.ts`)
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) — lint, typecheck, test, build
- GitHub Actions release workflow (`.github/workflows/release.yml`) — Docker build & push to GHCR
- Multi-stage production Dockerfile with Prisma 7 support
- `.dockerignore` for optimized Docker builds
- Helm charts (`helm/`) with Chart.yaml, values files (base, dev, staging, prod), and Kubernetes templates (deployment, service, configmap, secret, HPA, ServiceMonitor)

#### Database (Wave 3)

- Prisma 7 schema (`prisma/schema.prisma`) with 6 enums and 8 models (Project, ProjectContent, Scene, Character, ProjectVersion, WorkflowExecution, WorkflowStep, ShareLink)
- Prisma 7 CLI configuration (`prisma.config.ts`) with `defineConfig`
- Generated typed Prisma client (`src/generated/prisma/`)
- PrismaService with `@prisma/adapter-pg` driver adapter (`src/common/database/prisma.service.ts`)
- Global PrismaModule (`src/common/database/prisma.module.ts`)

#### Auth & Validation (Wave 3)

- `@Public()` decorator (`src/common/decorators/public.decorator.ts`)
- `@CurrentUser()` parameter decorator (`src/common/decorators/current-user.decorator.ts`)
- Gateway auth guard (`src/common/guards/gateway-auth.guard.ts`) — X-User-Id UUID validation
- Zod validation pipe (`src/common/pipes/zod-validation.pipe.ts`) with field-level error formatting
- Global HTTP exception filter (`src/common/filters/http-exception.filter.ts`)
- Shared types and Prisma enum re-exports (`src/common/types/index.ts`)
- Logging interceptor (`src/common/interceptors/logging.interceptor.ts`) with correlation ID propagation

#### Application Bootstrap (Wave 4)

- Application entry point (`src/main.ts`) with CORS, global prefix, Swagger, graceful shutdown
- Root AppModule (`src/app.module.ts`) with ConfigModule, LoggerModule, PrismaModule, HealthModule
- Health module (`src/health/`) with readiness probe (Prisma, Redis, NATS checks) and liveness probe
- Custom health indicators for Redis (`redis.health.ts`) and NATS (`nats.health.ts`) using HealthIndicatorService API

#### Foundation Tests (Wave 5)

- 36 unit tests across 5 test files, all passing
- `test/unit/common/app-config.spec.ts` — env validation, defaults, coercion, error messages
- `test/unit/common/gateway-auth-guard.spec.ts` — UUID validation, 401 errors, @Public() bypass
- `test/unit/common/zod-validation-pipe.spec.ts` — validation, error formatting, extra field stripping
- `test/unit/common/http-exception-filter.spec.ts` — response format, logging levels, error types
- `test/unit/health/health.spec.ts` — health check controller with mocked indicators

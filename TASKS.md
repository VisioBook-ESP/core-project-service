# TASKS.md — Parallel Agent Teams Development Plan

> organized for **Claude Agent Teams** parallel development.
> Each **Wave** is a set of tasks that can run concurrently with zero blocking dependencies between agents.
> Cross-references (§4, F-PM-01) point to ARCHITECTURE.md sections and feature IDs.

---

## Table of Contents

- [Agent Profiles](#agent-profiles)
- [Dependency Overview](#dependency-overview)
- [Phase 1 — Foundation](#phase-1--foundation) (Waves 1–5)
- [Phase 2 — Core MVP](#phase-2--core-mvp) (Waves 6–11)
- [Phase 3 — Extended MVP](#phase-3--extended-mvp) (Waves 12–14)
- [Phase 4 — Polish](#phase-4--polish) (Waves 15–16)
- [Summary](#summary)

---

## Agent Profiles

| Profile             | ID            | Skills & Responsibilities                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend Dev**     | `backend`     | NestJS modules, controllers, services, DTOs, guards, pipes, filters, decorators, dependency injection. TypeScript strict mode, Zod schemas, `createZodDto()`, NestJS exception handling, CRUD patterns, ownership enforcement, input sanitization.                                                                |
| **Database Dev**    | `database`    | Prisma ORM, PostgreSQL, schema design, enums, migrations, `PrismaService` lifecycle, raw SQL (`$queryRaw`), full-text search (tsvector/GIN), indexes, unique constraints, cascade deletes.                                                                                                                        |
| **Integration Dev** | `integration` | NATS JetStream (streams, consumers, pub/sub), BullMQ (queues, processors, retries, backoff), XState v5 (state machines, guards, actions, context), HTTP clients (Axios, retry/timeout strategies), SSE (Server-Sent Events), workflow orchestration, event-driven architecture.                                   |
| **DevOps Dev**      | `devops`      | Docker multi-stage builds, Helm charts (templates, values, environments), GitHub Actions CI/CD, environment configuration (Zod validation), Pino structured logging, Prometheus metrics (`prom-client`), OpenAPI/Swagger docs, health checks (`@nestjs/terminus`), correlation ID propagation, graceful shutdown. |
| **Testing Dev**     | `testing`     | Vitest (globals, projects, coverage), testcontainers (PostgreSQL, Redis, NATS), supertest (HTTP assertions), mocking strategies (Prisma, Redis, NATS, HTTP), unit/integration/E2E test patterns, test helpers and factories.                                                                                      |

---

## Dependency Overview

```
Wave 1  ──→  Wave 2  ──→  Wave 3  ──→  Wave 4  ──→  Wave 5
(config)    (env+CI)    (DB+auth)    (bootstrap)   (P0 tests)
                                          │
                                          ▼
                          Wave 6  ──→  Wave 7  ──→  Wave 8  ──→  Wave 9
                         (DTOs+NATS)  (project)  (content+ver)  (workflow)
                                                                    │
                                                                    ▼
                                                      Wave 10 ──→ Wave 11
                                                     (P1 unit)  (P1 integ)
                                                                    │
                                                                    ▼
                                              Wave 12 ──→ Wave 13 ──→ Wave 14
                                            (features)   (swagger)   (P2 tests)
                                                                        │
                                                                        ▼
                                                          Wave 15 ──→ Wave 16
                                                          (polish)   (P3 tests)
```

**Critical path** (longest sequential chain): Wave 1 → 2 → 3 → 4 → 6 → 7 → 8 → 9 → 12 → 15

---

## Phase 1 — Foundation

> Merge original Phase 0 (remaining scaffolding) with Phase 1 (P0 infrastructure).
> Build the mandatory foundation every other feature depends on.

---

### Wave 1: Scaffolding Config Files

> **Depends on**: Phase 0.1 complete (package.json exists) | **Parallel agents: 2** | **Profiles**: `backend`, `devops`

#### Agent: `backend` — "config-typescript"

Sequential: 0.2 → 0.3

- [x] **(0.2)** Create `tsconfig.json` with: `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `outDir: "dist"`, `rootDir: "src"`, `declaration: true`, `esModuleInterop: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`. Add paths alias `"@/*": ["src/*"]`. Exclude `node_modules`, `dist`, `test`.
- [x] **(0.3a)** Create `.eslintrc.cjs`: extend `["@typescript-eslint/recommended", "prettier"]`, parser `@typescript-eslint/parser`, parserOptions `{ project: "tsconfig.json" }`. Enable rules relevant to NestJS (no-unused-vars as warn, explicit-function-return-type off).
- [x] **(0.3b)** Create `.prettierrc`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true, "tabWidth": 2 }`.
- [x] **(0.3c)** Create `vitest.config.ts`: globals `true`, root `./`. Define three project configurations: `unit` (include `test/unit/**/*.spec.ts`), `integration` (include `test/integration/**/*.integration.spec.ts`), `e2e` (include `test/e2e/**/*.e2e.spec.ts`). Coverage provider `v8`. Pool `forks` (testcontainers compatibility). Aliases `@/` → `src/`.

#### Agent: `devops` — "config-devops"

- [x] **(0.4)** Create `.env.example` documenting every variable from §16 with descriptive comments and placeholder values:
  - **Application**: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `SWAGGER_ENABLED`, `CORS_ORIGINS`
  - **Database**: `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`
  - **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS_ENABLED`
  - **NATS**: `NATS_URL`, `NATS_USER`, `NATS_PASSWORD`, `NATS_STREAM_NAME`
  - **BullMQ**: `BULLMQ_CONCURRENCY`, `BULLMQ_MAX_RETRIES`
  - **External services**: `USER_SERVICE_URL`, `STORAGE_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `HTTP_CLIENT_TIMEOUT`
  - **Feature flags**: `FEATURE_SSE_ENABLED`, `FEATURE_SHARE_ENABLED`, `FEATURE_SEARCH_ENABLED`
- [x] **(0.5a)** Create `docker-compose.dev.yml` with three services:
  - `postgres`: image `postgres:16-alpine`, port `5432:5432`, env `POSTGRES_DB=visiobook_project`, `POSTGRES_USER=dev`, `POSTGRES_PASSWORD=dev`, volume `pgdata`.
  - `redis`: image `redis:7-alpine`, port `6379:6379`.
  - `nats`: image `nats:2.10-alpine`, port `4222:4222` + `8222:8222`, command `--jetstream --store_dir /data`, volume `natsdata`.
- [x] **(0.5b)** Update `.gitignore`: ensure it includes `node_modules/`, `dist/`, `.env`, `coverage/`, `*.tgz`, `.turbo/`.

---

### Wave 2: Core Configuration

> **Depends on**: Wave 1 | **Parallel agents: 2** | **Profiles**: `backend`, `devops`

#### Agent: `backend` — "env-config"

- [x] **(1.1a)** Create `src/common/config/app.config.ts`: define a Zod schema (`envSchema`) validating every environment variable from §16:
  - **Application**: `NODE_ENV` (enum `development|staging|production`, default `development`), `PORT` (number, default `8086`), `LOG_LEVEL` (enum `trace|debug|info|warn|error|fatal`, default `info`), `SWAGGER_ENABLED` (boolean coerced from string, default `true`), `CORS_ORIGINS` (string, default `*`).
  - **Database**: `DATABASE_URL` (string, required, starts with `postgresql://`), `DATABASE_POOL_MIN` (number, default `2`), `DATABASE_POOL_MAX` (number, default `10`).
  - **Redis**: `REDIS_HOST` (string, required), `REDIS_PORT` (number, default `6379`), `REDIS_PASSWORD` (string, optional), `REDIS_DB` (number, default `0`), `REDIS_TLS_ENABLED` (boolean, default `false`).
  - **NATS**: `NATS_URL` (string, required, e.g. `nats://localhost:4222`), `NATS_USER` (string, optional), `NATS_PASSWORD` (string, optional), `NATS_STREAM_NAME` (string, default `VISIOBOOK_PROJECT`).
  - **BullMQ**: `BULLMQ_CONCURRENCY` (number, default `5`), `BULLMQ_MAX_RETRIES` (number, default `3`).
  - **External services**: `USER_SERVICE_URL` (string, required), `STORAGE_SERVICE_URL` (string, required), `NOTIFICATION_SERVICE_URL` (string, required), `HTTP_CLIENT_TIMEOUT` (number, default `5000`).
  - **Feature flags**: `FEATURE_SSE_ENABLED` (boolean, default `true`), `FEATURE_SHARE_ENABLED` (boolean, default `true`), `FEATURE_SEARCH_ENABLED` (boolean, default `true`).
- [x] **(1.1b)** Export a `validateEnv()` function that parses `process.env` against the schema, throws a descriptive error listing all invalid/missing fields on failure (fail-fast), and returns the typed config object.
- [x] **(1.1c)** Export inferred TypeScript type `AppConfig = z.infer<typeof envSchema>`.
- [x] **(1.1d)** Create a NestJS config module (using `@nestjs/config` with custom `validate` function or a custom provider) that makes the validated `AppConfig` injectable throughout the application via `@Inject('APP_CONFIG')` or `ConfigService`.

#### Agent: `devops` — "ci-docker-helm"

Sequential within agent. No dependency on `backend` agent's output.

- [x] **(1.9a)** Create `.github/workflows/ci.yml` triggered on pull requests targeting `dev`:
  1. **install**: checkout repo, setup Node.js 22, setup pnpm, run `pnpm install --frozen-lockfile`, cache `node_modules` and pnpm store.
  2. **lint**: run `pnpm lint` and `pnpm format`. Depends on `install`.
  3. **typecheck**: run `pnpm typecheck`. Depends on `install`.
  4. **test-unit**: run `pnpm test:unit` with coverage reporting. Depends on `install`.
  5. **test-integration**: run `pnpm test:integration`. Requires Docker. Depends on `install`.
  6. **test-e2e**: run `pnpm test:e2e`. Requires Docker. Depends on `test-integration`.
  7. **docker-build**: run `docker build .` to verify image builds. Depends on `install`.
     All jobs: Ubuntu latest runner, timeout 15 minutes.
- [x] **(1.9b)** Create `.github/workflows/release.yml` triggered on push to `dev`:
  1. Build multi-stage Docker image.
  2. Tag with `${{ github.sha }}` and `dev-latest`.
  3. Login to GitHub Container Registry (`ghcr.io`) using `GITHUB_TOKEN`.
  4. Push image to `ghcr.io/visiobook/core-project-service`.
- [x] **(1.10a)** Create `Dockerfile`:
  - **Stage 1 — `builder`**: `FROM node:22-alpine AS builder`. Install pnpm globally. Set workdir `/app`. Copy `package.json`, `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile`. Copy `prisma/`. Run `pnpm prisma generate`. Copy `src/`, `tsconfig.json`. Run `pnpm build`.
  - **Stage 2 — `production`**: `FROM node:22-alpine`. Install pnpm globally. Set workdir `/app`. Copy `package.json`, `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile --prod`. Copy `--from=builder /app/dist ./dist`. Copy `--from=builder /app/prisma ./prisma`. Copy `--from=builder /app/node_modules/.prisma ./node_modules/.prisma`. Set `ENV NODE_ENV=production`. Expose `8086`. Add non-root user. Switch to `USER appuser`. Set `CMD ["node", "dist/main.js"]`.
- [x] **(1.10b)** Create `.dockerignore`: `node_modules`, `dist`, `.git`, `test`, `coverage`, `.env`, `*.md`, `.github`, `helm`, `.vscode`, `.idea`.
- [x] **(1.11a)** Create `helm/Chart.yaml`: `apiVersion: v2`, `name: core-project-service`, `version: 0.1.0`, `appVersion: "0.1.0"`, `type: application`.
- [x] **(1.11b)** Create `helm/values.yaml` with all base values from §13 (image, replicaCount: 2, resources, env, probes, hpa, serviceMonitor).
- [x] **(1.11c)** Create `helm/templates/deployment.yaml`: Kubernetes Deployment with container spec, env from ConfigMap/Secret, probes, resources.
- [x] **(1.11d)** Create `helm/templates/service.yaml`: ClusterIP Service on port `8086`.
- [x] **(1.11e)** Create `helm/templates/configmap.yaml`: ConfigMap holding non-secret env vars.
- [x] **(1.11f)** Create `helm/templates/secret.yaml`: Secret placeholder with keys `DATABASE_URL`, `REDIS_PASSWORD`, `NATS_USER`, `NATS_PASSWORD`.
- [x] **(1.11g)** Create `helm/templates/hpa.yaml`: HorizontalPodAutoscaler.
- [x] **(1.11h)** Create `helm/templates/servicemonitor.yaml`: Prometheus ServiceMonitor with `enabled` conditional.

---

### Wave 3: Infrastructure Layer

> **Depends on**: Wave 2 (needs 1.1 env config) | **Parallel agents: 3** | **Profiles**: `database`, `backend`, `devops`

#### Agent: `database` — "prisma-schema"

- [x] **(1.2a)** Create `prisma/schema.prisma`: set `datasource db` with provider `postgresql` and url `env("DATABASE_URL")`. Set `generator client` with provider `prisma-client-js`.
- [x] **(1.2b)** Define enum `ProjectStatus` (`draft`, `active`, `archived`).
- [x] **(1.2c)** Define enum `SourceType` (`file`, `scan`, `text`).
- [x] **(1.2d)** Define enum `VersionStatus` (`draft`, `analyzing`, `analyzed`, `configuring`, `generating`, `completed`, `failed`, `cancelled`).
- [x] **(1.2e)** Define enum `ExecutionStatus` (`pending`, `running`, `completed`, `failed`, `cancelled`).
- [x] **(1.2f)** Define enum `PipelineStep` (`analysis`, `scene_extraction`, `character_extraction`, `image_generation`, `audio_generation`, `assembly`).
- [x] **(1.2g)** Define enum `StepStatus` (`pending`, `running`, `completed`, `failed`, `skipped`).
- [x] **(1.2h)** Define `Project` model: `id` (uuid), `userId`, `title`, `status` (default draft), `sourceType`, `config` (Json), `createdAt`, `updatedAt`, `deletedAt?`. Relations: content, scenes, characters, versions, shareLinks, executions. Indexes: `[userId]`, `[deletedAt]`.
- [x] **(1.2i)** Define `ProjectContent` model: `id`, `projectId` (unique), `text`, `wordCount`, `summary?`, `metadata` (Json). Relation to Project (onDelete: Cascade).
- [x] **(1.2j)** Define `Scene` model: `id`, `projectId`, `order`, `text`, `description`, `imagePrompt`, `generatedImageUrl?`, `duration`, `sentiment?`. Relation to Project (Cascade). Indexes: `[projectId]`, unique `[projectId, order]`.
- [x] **(1.2k)** Define `Character` model: `id`, `projectId`, `name`, `description`, `aliases` (String[]), `traits` (String[]). Relation to Project (Cascade). Index: `[projectId]`.
- [x] **(1.2l)** Define `ProjectVersion` model: `id`, `projectId`, `versionNumber`, `config` (Json), `status` (default draft), `videoUrl?`, `createdAt`. Relation to Project (Cascade). Relations: executions. Indexes: `[projectId]`, unique `[projectId, versionNumber]`.
- [x] **(1.2m)** Define `WorkflowExecution` model: `id`, `projectId`, `versionId`, `status` (default pending), `currentStep?`, `progress` (default 0), `startedAt?`, `completedAt?`, `error?` (Json). Relations to Project, ProjectVersion (Cascade). Relations: steps. Index: `[versionId]`.
- [x] **(1.2n)** Define `WorkflowStep` model: `id`, `executionId`, `step` (PipelineStep), `status` (default pending), `progress` (default 0), `details?` (Json), `startedAt?`, `completedAt?`. Relation to WorkflowExecution (Cascade). Index: `[executionId]`.
- [x] **(1.2o)** Define `ShareLink` model: `id`, `projectId`, `shareToken` (unique), `passwordHash?`, `expiresAt?`, `allowDownload` (default false), `createdAt`. Relation to Project (Cascade). Index: `[projectId]`.
- [x] **(1.2p)** Run `npx prisma migrate dev --name init`. Verify all tables, enums, indexes, and unique constraints.
- [x] **(1.2q)** Run `npx prisma generate` to produce the typed Prisma Client.
- [x] **(1.2r)** Create `PrismaService`: extend `PrismaClient`, implement `onModuleInit()` → `$connect()` and `onModuleDestroy()` → `$disconnect()`. Export from a global `PrismaModule`.

#### Agent: `backend` — "auth-validation"

All tasks depend on 1.1 but NOT on each other. Any order within agent.

- [x] **(1.4a)** Create `src/common/decorators/public.decorator.ts`: define `@Public()` decorator using `SetMetadata('isPublic', true)`.
- [x] **(1.4b)** Create `src/common/guards/gateway-auth.guard.ts`: NestJS `CanActivate` guard. Check `@Public()` metadata → skip. Extract `X-User-Id` header, validate as non-empty UUID. Throw `UnauthorizedException` (401) if invalid.
- [x] **(1.4c)** Create `src/common/decorators/current-user.decorator.ts`: NestJS `createParamDecorator` extracting `X-User-Id` from request headers. Usage: `@CurrentUser() userId: string`.
- [x] **(1.5)** Create `src/common/pipes/zod-validation.pipe.ts`: NestJS `PipeTransform` using `nestjs-zod`. On validation failure, throw `BadRequestException` with `{ statusCode: 400, message: "Validation failed", errors: [{ field, message }] }`. Integrate with `@nestjs/swagger` for OpenAPI.
- [x] **(1.6a)** Create `src/common/filters/http-exception.filter.ts`: NestJS `ExceptionFilter<HttpException>` formatting errors as `{ statusCode, message, error, timestamp, path }`. Log 4xx at `warn`, 5xx at `error` via Pino.
- [x] **(1.6b)** Create `src/common/types/index.ts`: define and export:
  - `PaginatedResponse<T>`: `{ items: T[], total, page, pageSize, totalPages }`.
  - `ApiErrorResponse`: `{ statusCode, message, error, timestamp, path }`.
  - Re-export relevant Prisma enums (`ProjectStatus`, `SourceType`, `VersionStatus`, `ExecutionStatus`, `PipelineStep`, `StepStatus`).

#### Agent: `devops` — "logging"

- [x] **(1.3a)** Configure `nestjs-pino` `LoggerModule` in `AppModule`:
  - Pino transport: stdout in JSON format.
  - Log level from `AppConfig.LOG_LEVEL`.
  - Auto-logging enabled for request/response pairs.
  - Redact sensitive paths: `["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"]`.
  - Custom serializers for `correlationId`, `userId`, `method`, `path`, `statusCode`, `responseTime`.
- [x] **(1.3b)** Create `src/common/interceptors/logging.interceptor.ts`: NestJS `NestInterceptor` that:
  - Extracts `X-Request-Id` from request headers (or generates UUID if absent) → stores as `correlationId`.
  - Extracts `X-User-Id` → stores as `userId`.
  - Logs request start and response completion at `info` level.
  - Attaches `correlationId` to the request object for downstream use.

---

### Wave 4: App Assembly

> **Depends on**: Wave 3 (needs 1.2 PrismaModule + 1.3–1.6 common infrastructure) | **Parallel agents: 1** | **Profiles**: `backend`
>
> **This is a convergence point** — all Wave 3 agents must complete before this wave starts.

#### Agent: `backend` — "bootstrap"

Sequential: 1.7 → 1.8

- [x] **(1.7a)** Create `src/main.ts`:
  1. Call `validateEnv()` at the top (fail-fast).
  2. Create NestJS application (`NestFactory.create(AppModule)`).
  3. Enable CORS with `origin` from `AppConfig.CORS_ORIGINS` (split comma-separated).
  4. Set global prefix `/api/v1` — exclude `/health` and `/metrics`.
  5. Apply global pipes: `ZodValidationPipe`.
  6. Apply global filters: `HttpExceptionFilter`.
  7. Apply global interceptors: `LoggingInterceptor`.
  8. Configure Swagger conditionally (`if (config.SWAGGER_ENABLED)`).
  9. Enable shutdown hooks.
  10. Listen on `AppConfig.PORT`.
- [x] **(1.7b)** Create `src/app.module.ts`: root `AppModule` importing:
  - `LoggerModule` (nestjs-pino) — from 1.3.
  - Custom `ConfigModule` — from 1.1.
  - `PrismaModule` — from 1.2.
  - `HealthModule` — from 1.8.
  - Global guard provider `{ provide: APP_GUARD, useClass: GatewayAuthGuard }`.
  - (Feature modules added in later waves.)
- [x] **(1.8)** Create `src/health/health.module.ts`: NestJS module using `@nestjs/terminus`. Define `HealthController` with:
  - `GET /health/ready` (`@Public()`): readiness probe checking PostgreSQL (Prisma `$queryRaw(SELECT 1)`), Redis (ioredis ping), NATS connection. Return `200` or `503`.
  - `GET /health/live` (`@Public()`): liveness probe — always `200 { status: "ok" }`.
  - Import `HealthModule` in `AppModule`.

---

### Wave 5: Foundation Tests

> **Depends on**: Wave 4 | **Parallel agents: 1** | **Profiles**: `testing`

#### Agent: `testing` — "p0-tests"

- [x] **(1.12a)** Create directory structure: `test/unit/common/`, `test/unit/health/`.
- [x] **(1.12b)** Create `test/unit/common/app-config.spec.ts`: test `validateEnv()` — valid config returns typed object; missing `DATABASE_URL` throws; missing `REDIS_HOST` throws; defaults applied for optional vars; invalid types rejected.
- [x] **(1.12c)** Create `test/unit/common/gateway-auth-guard.spec.ts`: mock `ExecutionContext`. Tests: valid UUID passes; missing header → 401; empty string → 401; non-UUID → 401; `@Public()` metadata bypasses guard.
- [x] **(1.12d)** Create `test/unit/common/zod-validation-pipe.spec.ts`: test with sample Zod schema — valid input passes; invalid input → `BadRequestException` with field-level errors; extra fields stripped.
- [x] **(1.12e)** Create `test/unit/common/http-exception-filter.spec.ts`: mock `ArgumentsHost`. Tests: `HttpException(400)` produces correct body; logs 4xx at warn; logs 5xx at error; unknown exceptions → 500.
- [x] **(1.12f)** Create `test/unit/health/health.spec.ts`: mock Prisma, Redis, NATS. Tests: all healthy → 200; DB down → 503; Redis down → 503; NATS down → 503; live → always 200.

---

## Phase 2 — Core MVP

> Core user-facing features: project CRUD, content management, version management, workflow engine, messaging, and HTTP clients.

---

### Wave 6: Module Foundations

> **Depends on**: Wave 5 (Phase 1 complete) | **Parallel agents: 2** | **Profiles**: `backend`, `integration`

#### Agent: `backend` — "project-dtos"

- [ ] **(2.1a)** Create `src/project/dto/create-project.dto.ts`: Zod schema `CreateProjectDto` — `title` (string, min 1, max 200), `sourceType` (enum `file | scan | text`), `config` (JSON, optional, default `{}`), `content` (object with `text` string min 1 and `metadata` JSON optional). Export type via `z.infer`. Register with `createZodDto()`.
- [ ] **(2.1b)** Create `src/project/dto/update-project.dto.ts`: Zod schema `UpdateProjectDto` — `title` (optional), `config` (optional). All fields optional (partial update). Export type.
- [ ] **(2.1c)** Create `src/project/dto/project-response.dto.ts`: Zod schema `ProjectResponseDto` — `id`, `userId`, `title`, `status`, `sourceType`, `config`, `createdAt`, `updatedAt`. Export type.
- [ ] **(2.1d)** Create `src/project/dto/list-projects-query.dto.ts`: Zod schema — `page` (number, default 1, min 1), `pageSize` (number, default 20, min 1, max 100), `sortBy` (enum `createdAt | updatedAt`, default `updatedAt`), `sortOrder` (enum `asc | desc`, default `desc`). Export type.

#### Agent: `integration` — "nats-clients-xstate"

Sequential chain for NATS (2.14→2.15→2.16→2.17), then independent tasks.

- [ ] **(2.14)** Create `src/messaging/subjects.ts` exporting all NATS subject string constants:
  - **Outbound**: `PROJECT_WORKFLOW_STARTED`, `PROJECT_WORKFLOW_STEP_COMPLETED`, `PROJECT_WORKFLOW_COMPLETED`, `PROJECT_WORKFLOW_FAILED`, `PROJECT_WORKFLOW_CANCELLED`, `PROJECT_DELETED`.
  - **Inbound**: `AI_ANALYSIS_COMPLETED`, `AI_ANALYSIS_FAILED`, `AI_MEDIA_IMAGE_COMPLETED`, `AI_MEDIA_AUDIO_COMPLETED`, `AI_ASSEMBLY_COMPLETED`, `AI_ASSEMBLY_FAILED`, `AI_PROGRESS`.
  - **Stream config**: `STREAM_NAME`, `STREAM_SUBJECTS`, `CONSUMER_NAME`, `CONSUMER_FILTER`.
- [ ] **(2.15a)** Create `src/messaging/nats.publisher.ts`: injectable `NatsPublisher`. On `onModuleInit()`:
  1. Connect to NATS using config (`NATS_URL`, optional user/pass).
  2. Obtain JetStream manager.
  3. Ensure stream `VISIOBOOK_PROJECT` exists with config: subjects `['visiobook.project.>']`, retention `LimitsRetention`, storage `FileStorage`, max_bytes `1GB`, max_age `7 days`, discard `DiscardOld`, max_msg_size `1MB`.
  4. Obtain JetStream client for publishing.
- [ ] **(2.15b)** Implement publish methods: `publishWorkflowStarted`, `publishStepCompleted`, `publishWorkflowCompleted`, `publishWorkflowFailed`, `publishWorkflowCancelled`, `publishProjectDeleted`. Each: publish JSON, await JetStream ack (5s timeout), retry 3 times, log error on exhaustion.
- [ ] **(2.15c)** Define TypeScript interfaces for each event payload matching §10 field tables.
- [ ] **(2.16a)** Create `src/messaging/nats.subscriber.ts`: injectable `NatsSubscriber`. On `onModuleInit()`:
  1. Connect to NATS.
  2. Add durable consumer `core-project-service` on stream with config: ack policy `Explicit`, ack wait `30s`, max deliver `5`, filter subject `visiobook.ai.>`.
  3. Start consuming messages.
- [ ] **(2.16b)** Route messages by subject to handlers: `handleAnalysisCompleted`, `handleAnalysisFailed`, `handleImageCompleted`, `handleAudioCompleted`, `handleAssemblyCompleted`, `handleAssemblyFailed`, `handleProgress`. Each handler: parse JSON, validate fields, `msg.ack()` on success, `msg.nak()` on error. **Stub handler bodies with TODO** — full implementations in Wave 9 (task 2.26).
- [ ] **(2.16c)** Define TypeScript interfaces for inbound event payloads.
- [ ] **(2.17)** Create `src/messaging/messaging.module.ts`: provide `NatsPublisher` and `NatsSubscriber`, import config. Implement `onModuleDestroy()` to drain NATS connections. Export both services.
- [ ] **(2.18)** Create `src/clients/user-service.client.ts`: injectable `UserServiceClient` using `HttpService`. Methods:
  - `checkQuota(userId)`: `GET {USER_SERVICE_URL}/api/v1/users/{userId}/quota`. Timeout 5s, retry 3× exponential backoff (1s, 2s, 4s). Throw `503` on exhaustion.
  - `decrementQuota(userId)`: `POST {USER_SERVICE_URL}/api/v1/users/{userId}/quota/decrement`. Same retry strategy.
  - Include `X-Request-Id` header.
- [ ] **(2.19)** Create `src/clients/storage-service.client.ts`: injectable `StorageServiceClient`. Methods:
  - `getUploadUrl(params)`: `POST .../upload-url`. Timeout 10s, retry 3×. Throw 503.
  - `deleteFile(key)`: `DELETE .../files/{key}`. Same strategy.
  - `getFileMetadata(key)`: `GET .../files/{key}/metadata`. Same strategy.
  - Include `X-Request-Id` header.
- [ ] **(2.20)** Create `src/workflow/workflow.machine.ts`: XState v5 `createMachine` for project version lifecycle:
  - **Context**: `{ projectId, versionId, executionId, hasContent, hasQuota, hasScenes, retryCount, maxRetries }`.
  - **States**: `draft`, `analyzing`, `analyzed`, `generating`, `completed`, `failed`, `cancelled`.
  - **Transitions**: `draft→analyzing` (guards: `hasContent` AND `hasQuota`), `analyzing→analyzed`, `analyzing→failed`, `analyzing→cancelled`, `analyzed→generating` (guard: `hasScenes`), `generating→completed`, `generating→failed`, `generating→cancelled`, `failed→analyzing` (guard: `isRetryAllowed`).
  - **Guards**: `hasContent`, `hasQuota`, `hasScenes`, `isRetryAllowed` (pure functions).
  - Export machine definition, context type, event types.
- [ ] **(2.23)** Implement weighted progress calculation as a pure utility function (testable in isolation):
  - Step weights: `analysis=15`, `image_generation=40`, `audio_generation=20`, `assembly=25`.
  - `Overall = Σ (step.progress × step.weight) / 100`. For `image_generation`, compute per-scene sub-progress.
  - Handle `scene_extraction` and `character_extraction` as sub-phases of `analysis` (bundled into 15% weight).
  - Return clamped integer 0–100.

---

### Wave 7: Project Module

> **Depends on**: Wave 6 (needs 2.1 DTOs + 2.17 MessagingModule) | **Parallel agents: 2** | **Profiles**: `backend`, `integration`

#### Agent: `backend` — "project-module"

Sequential: 2.2 → 2.3 → 2.4 → 2.5

- [ ] **(2.2)** Create `src/project/project.service.ts` with `PrismaService` and `NatsPublisher` injected. Methods:
  - `create(userId, dto)`: in Prisma transaction, create `Project` + `ProjectContent` (compute wordCount). Return project with content.
  - `findById(projectId, userId)`: query where `id = projectId AND userId AND deletedAt = null`. Throw `NotFoundException` if not found (404, not 403, to prevent enumeration).
  - `findAllByUser(userId, query)`: query with pagination, sort. Return `PaginatedResponse<Project>`.
  - `update(projectId, userId, dto)`: ownership check. Verify no active workflow (latest version status not `analyzing`/`generating` → else `ConflictException` 409). Update fields.
  - `softDelete(projectId, userId)`: ownership check. Set `deletedAt`. Collect storage keys. Publish `visiobook.project.deleted` NATS event.
- [ ] **(2.3)** Create `src/project/project.controller.ts` with route prefix `projects`. Endpoints:
  - `POST /` → `createProject`: return `201`.
  - `GET /` → `listProjects`: return `200` with paginated list.
  - `GET /:id` → `getProject`: return `200`.
  - `PATCH /:id` → `updateProject`: return `200`.
  - `DELETE /:id` → `deleteProject`: return `204`.
- [ ] **(2.4)** Create `src/project/project.module.ts`: declare `ProjectController`, provide `ProjectService`. Import `PrismaModule`, `MessagingModule`. Export `ProjectService`.
  - Import `ProjectModule` in `src/app.module.ts`.
- [ ] **(2.5)** Export `ensureOwnership(projectId, userId): Promise<Project>` from `ProjectService` — alias for `findById` making ownership-check intent explicit. Verify no code path leaks ownership info.

#### Agent: `integration` — "bullmq-processor"

- [ ] **(2.21a)** Configure BullMQ in `WorkflowModule` (or `AppModule`): `BullModule.forRoot()` with Redis connection from config. Register queue: `BullModule.registerQueue({ name: 'project-workflow' })`.
- [ ] **(2.21b)** Create `src/workflow/workflow.processor.ts`: BullMQ `@Processor('project-workflow')` with concurrency from `BULLMQ_CONCURRENCY`. Route by job name:
  - `workflow:analysis`: update WorkflowStep to `running`, publish NATS event.
  - `workflow:image-generation`: update step, publish NATS events per scene.
  - `workflow:audio-generation`: update step, publish NATS event.
  - `workflow:assembly`: update step, publish NATS event.
  - Per-job defaults: `attempts` = `BULLMQ_MAX_RETRIES`, `backoff` = exponential 1s, `timeout` = 5 min, `stalledInterval` = 30s.
- [ ] **(2.21c)** Implement `@OnWorkerEvent('failed')` handler: log failure details.

---

### Wave 8: Feature Modules

> **Depends on**: Wave 7 (needs 2.4 ProjectModule + 2.5 ensureOwnership) | **Parallel agents: 2** | **Profiles**: `backend` ×2

#### Agent: `backend` — "content-module"

Sequential: 2.6 → 2.7 → 2.8 → 2.9

- [ ] **(2.6a)** Create `src/content/dto/update-content.dto.ts`: Zod schema — `text` (string, min 1, optional), `metadata` (JSON, optional). Export type.
- [ ] **(2.6b)** Create `src/content/dto/content-response.dto.ts`: Zod schema — `id`, `projectId`, `text`, `wordCount`, `summary`, `metadata`. Export type.
- [ ] **(2.6c)** Create `src/content/dto/scene-response.dto.ts`: Zod schema — `id`, `projectId`, `order`, `text`, `description`, `imagePrompt`, `generatedImageUrl`, `duration`, `sentiment`. Export type.
- [ ] **(2.7)** Create `src/content/content.service.ts` with `PrismaService` and `ProjectService` injected. Methods:
  - `getContent(projectId, userId)`: `ensureOwnership`. Query `ProjectContent`. Throw 404 if none.
  - `updateContent(projectId, userId, dto)`: `ensureOwnership`. Update `ProjectContent`. Recompute `wordCount` if `text` updated.
  - `listScenes(projectId, userId)`: `ensureOwnership`. Return `Scene[]` ordered by `order ASC`.
- [ ] **(2.8)** Create `src/content/content.controller.ts` with prefix `projects/:projectId/content`. Endpoints:
  - `GET /` → `getContent`: return `200`.
  - `PATCH /` → `updateContent`: return `200`.
  - `GET /scenes` → `listScenes`: return `200`.
- [ ] **(2.9)** Create `src/content/content.module.ts`: declare `ContentController`, provide `ContentService`, import `PrismaModule` and `ProjectModule`. Export `ContentService`.
  - Import `ContentModule` in `src/app.module.ts`.

#### Agent: `backend` — "version-module"

Sequential: 2.10 → 2.11 → 2.12 → 2.13

- [ ] **(2.10a)** Create `src/version/dto/create-version.dto.ts`: Zod schema — `config` (JSON, optional — if omitted, snapshots current project config). Export type.
- [ ] **(2.10b)** Create `src/version/dto/version-response.dto.ts`: Zod schema — `id`, `projectId`, `versionNumber`, `config`, `status`, `videoUrl`, `createdAt`. Optionally includes nested `executions` array. Export type.
- [ ] **(2.11)** Create `src/version/version.service.ts` with `PrismaService` and `ProjectService`. Methods:
  - `create(projectId, userId, dto?)`: `ensureOwnership`. Auto-increment `versionNumber`. Snapshot config. Create `ProjectVersion` with status `draft`.
  - `listByProject(projectId, userId)`: `ensureOwnership`. Return versions ordered by `versionNumber DESC`.
  - `findById(projectId, versionId, userId)`: `ensureOwnership`. Include `WorkflowExecution` + `WorkflowStep`. Throw 404 if not found.
- [ ] **(2.12)** Create `src/version/version.controller.ts` with prefix `projects/:projectId/versions`. Endpoints:
  - `POST /` → `createVersion`: return `201`.
  - `GET /` → `listVersions`: return `200`.
  - `GET /:versionId` → `getVersion`: return `200` with executions + steps.
- [ ] **(2.13)** Create `src/version/version.module.ts`: declare `VersionController`, provide `VersionService`, import `PrismaModule` and `ProjectModule`. Export `VersionService`.
  - Import `VersionModule` in `src/app.module.ts`.

---

### Wave 9: Workflow Engine Assembly

> **Depends on**: Wave 8 (needs ContentService from 2.9, BullMQ from 2.21, all Wave 6 outputs) | **Parallel agents: 1** | **Profiles**: `integration`
>
> **Critical path bottleneck** — this is the most dependency-heavy task. Integration Dev should focus exclusively.

#### Agent: `integration` — "workflow-engine"

Sequential: 2.22 → 2.24 → 2.25 → 2.26

- [ ] **(2.22a)** Create `src/workflow/workflow.service.ts` with dependencies: `PrismaService`, `Queue` (BullMQ), `NatsPublisher`, `UserServiceClient`, `ProjectService`, `ContentService`. Implement:
  - **`startWorkflow(projectId, versionId, userId)`**:
    1. `ensureOwnership`.
    2. Load `ProjectVersion`, verify status `draft` (or `failed` for retry). Throw `ConflictException` if running.
    3. Load `ProjectContent`, verify non-empty (`hasContent`). Throw `BadRequestException` if empty.
    4. `checkQuota(userId)`, verify `remaining > 0`. Throw `ForbiddenException` if no quota.
    5. Create `WorkflowExecution` (status `pending`) + `WorkflowStep` records for each pipeline step.
    6. Interpret XState machine, send `START_WORKFLOW`. Verify transition to `analyzing`.
    7. Update `ProjectVersion.status` to `analyzing`.
    8. Update `WorkflowExecution.status` to `running`, set `startedAt`, `currentStep = 'analysis'`.
    9. Enqueue BullMQ job `workflow:analysis`.
    10. Return execution record.
  - **`getWorkflowStatus(projectId, versionId, userId)`**:
    1. `ensureOwnership`.
    2. Load latest `WorkflowExecution`.
    3. Load `WorkflowStep` records.
    4. Compute weighted progress using the progress utility (from 2.23).
    5. Return `{ status, progress, currentStep, steps }`.
  - **`advanceWorkflow(executionId, completedStep, result)`**: update step to completed, recalculate progress, enqueue next BullMQ job, publish `step_completed`. If no more steps → `completeWorkflow()`.
  - **`failWorkflow(executionId, failedStep, error)`**: update step to failed. If retries exhausted → update execution + version to failed, publish `workflow.failed`.
  - **`completeWorkflow(executionId, videoUrl)`**: set `ProjectVersion.videoUrl` + status `completed`, update execution, decrement quota, publish `workflow.completed`.
- [ ] **(2.24a)** Create `src/workflow/workflow.controller.ts` with prefix `projects/:projectId/versions/:versionId/workflow`. Endpoints:
  - `POST /start` → `startWorkflow`: return `202` Accepted.
  - `GET /status` → `getWorkflowStatus`: return `200`.
    Validate route params as UUIDs.
- [ ] **(2.24b)** Create `src/workflow/dto/workflow-status-response.dto.ts`: Zod schema — `executionId`, `status`, `progress` (0–100), `currentStep`, `steps` (array).
- [ ] **(2.25)** Create `src/workflow/workflow.module.ts`: declare `WorkflowController`, provide `WorkflowService`, `WorkflowProcessor`. Import `PrismaModule`, `ProjectModule`, `ContentModule`, `VersionModule`, `MessagingModule`, `BullModule.registerQueue({ name: 'project-workflow' })`. Export `WorkflowService`.
  - Import `WorkflowModule` in `src/app.module.ts`.
  - Configure BullMQ root connection in `AppModule` if not already done.
- [ ] **(2.26)** Update `src/messaging/nats.subscriber.ts` — implement full handler logic:
  - **`handleAnalysisCompleted(data)`**: in Prisma transaction: bulk-create `Scene` records, bulk-create `Character` records, update `ProjectContent.summary`, update `WorkflowStep` records (analysis + scene_extraction + character_extraction → completed), transition version to `analyzed`, enqueue `workflow:image-generation`.
  - **`handleAnalysisFailed(data)`**: call `workflowService.failWorkflow()`.
  - **`handleImageCompleted(data)`**: update `Scene.generatedImageUrl`, update `WorkflowStep` image_generation progress. If ALL scenes done → advance to `workflow:audio-generation`.
  - **`handleAudioCompleted(data)`**: store audio URLs, update step to completed, enqueue `workflow:assembly`.
  - **`handleAssemblyCompleted(data)`**: call `workflowService.completeWorkflow()`.
  - **`handleAssemblyFailed(data)`**: call `workflowService.failWorkflow()`.
  - **`handleProgress(data)`**: update `WorkflowStep.progress`.

---

### Wave 10: P1 Unit Tests

> **Depends on**: Wave 9 | **Parallel agents: 1** | **Profiles**: `testing`
>
> **Progressive start**: Testing Dev can begin writing test stubs for completed modules during Waves 7–9.

#### Agent: `testing` — "p1-unit-tests"

- [ ] **(2.27a)** Create `test/unit/project/project.service.spec.ts`: mock Prisma + NatsPublisher. Tests: `create` (transaction, wordCount), `findById` (correct owner, wrong owner → 404, non-existent → 404), `findAllByUser` (pagination, sort, empty), `update` (fields, conflict when workflow running, non-owner → 404), `softDelete` (sets deletedAt, publishes NATS event, non-owner → 404).
- [ ] **(2.27b)** Create `test/unit/content/content.service.spec.ts`: mock Prisma + ProjectService. Tests: `getContent` (returns content, 404 when none, calls ensureOwnership), `updateContent` (updates text + recomputes wordCount, updates metadata), `listScenes` (ordered by order ASC, empty array).
- [ ] **(2.27c)** Create `test/unit/version/version.service.spec.ts`: mock Prisma + ProjectService. Tests: `create` (auto-increment versionNumber, snapshot config), `listByProject` (ordered DESC), `findById` (nested executions + steps, 404).
- [ ] **(2.27d)** Create `test/unit/workflow/workflow.machine.spec.ts`: test XState machine directly: all valid transitions produce correct next state; `draft→analyzing` blocked when `hasContent=false` or `hasQuota=false`; `analyzed→generating` blocked when `hasScenes=false`; `failed→analyzing` blocked when retries exceeded; invalid transitions don't change state.
- [ ] **(2.27e)** Create `test/unit/workflow/workflow.service.spec.ts`: mock all deps. Tests: `startWorkflow` (ownership, content, quota, creates execution + steps, enqueues job, publishes event; failure paths: no content 400, no quota 403, not draft 409), `getWorkflowStatus` (weighted progress), `advanceWorkflow` (updates step, recalculates, enqueues next), `failWorkflow` (marks failed, publishes), `completeWorkflow` (sets videoUrl, decrements quota, publishes).
- [ ] **(2.27f)** Create `test/unit/workflow/workflow.progress.spec.ts`: test progress utility: all 0% → 0%, analysis 100% → 15%, analysis+images 100% → 55%, all 100% → 100%, partial image (3/5 scenes), clamping.
- [ ] **(2.27g)** Create `test/unit/messaging/nats.publisher.spec.ts`: mock JetStream client. Test each publish method: correct subject, JSON payload, ack awaited, retry on failure, log on exhaustion.
- [ ] **(2.27h)** Create `test/unit/messaging/nats.subscriber.spec.ts`: mock messages. Test each handler: parsing, ack on success, nak on error, routing by subject.
- [ ] **(2.27i)** Create `test/unit/clients/user-service.client.spec.ts`: mock `HttpService`. Tests: `checkQuota` (returns response, retries on 500, throws 503 after 3), `decrementQuota` (POST, retries).
- [ ] **(2.27j)** Create `test/unit/clients/storage-service.client.spec.ts`: mock `HttpService`. Tests: `getUploadUrl`, `deleteFile`, `getFileMetadata` (retries, 503 on exhaustion).

---

### Wave 11: P1 Integration Tests

> **Depends on**: Wave 10 | **Parallel agents: 1** | **Profiles**: `testing`

#### Agent: `testing` — "p1-integration-tests"

- [ ] **(2.28a)** Create `test/integration/setup.ts`: testcontainers setup — start PostgreSQL 16, Redis 7, NATS 2.10. Apply Prisma migrations. Export connection URLs and Prisma client. Teardown in `afterAll`.
- [ ] **(2.28b)** Create `test/integration/project/project.service.integration.spec.ts`: test against real PostgreSQL: CRUD persists correctly, userId index, soft-delete behavior, unique constraints, cascade delete.
- [ ] **(2.28c)** Create `test/integration/workflow/workflow.processor.integration.spec.ts`: test against real Redis: job pickup, retry on failure, timeout/stall detection, exponential backoff.
- [ ] **(2.28d)** Create `test/integration/messaging/nats.integration.spec.ts`: test against real NATS: publish→subscribe, JetStream ack/nak, durable consumer reconnect, max deliver behavior.

---

## Phase 3 — Extended MVP

> Enhanced features: full-text search, content details, workflow management, sharing, notifications, observability, and comprehensive testing.

---

### Wave 12: Feature Extensions

> **Depends on**: Wave 11 (Phase 2 complete) | **Parallel agents: 5** | **Profiles**: `backend` ×2, `integration`, `database`, `devops`
>
> **Maximum parallelism wave** — all tasks depend only on Phase 2 outputs.

#### Agent: `backend` — "content-extensions"

- [ ] **(3.2a)** Add `getSummary(projectId, userId)` method to `ContentService`: verify ownership, query `ProjectContent.summary`. Return `{ summary }` (or null if not yet analyzed).
- [ ] **(3.2b)** Add `GET /summary` endpoint to `ContentController`: return `200`.
- [ ] **(3.3a)** Create `src/content/dto/update-scene.dto.ts`: Zod schema — `text` (optional), `description` (optional), `imagePrompt` (optional). At least one field required.
- [ ] **(3.3b)** Add `updateScene(projectId, sceneId, userId, dto)` method to `ContentService`: verify ownership, find `Scene` by `id` AND `projectId`, throw 404 if not found, update fields.
- [ ] **(3.3c)** Add `PATCH /scenes/:sceneId` endpoint to `ContentController`: return `200`.
- [ ] **(3.4a)** Create `src/content/dto/character-response.dto.ts`: Zod schema — `id`, `projectId`, `name`, `description`, `aliases`, `traits`.
- [ ] **(3.4b)** Add `listCharacters(projectId, userId)` method to `ContentService`: verify ownership, return `Character[]`.
- [ ] **(3.4c)** Add `GET /characters` endpoint to `ContentController`: return `200`.

#### Agent: `backend` — "share-module"

Sequential: 3.8 → 3.9 → 3.10

- [ ] **(3.8a)** Create `src/share/dto/create-share-link.dto.ts`: Zod schema — `expiresAt` (ISO 8601, optional, must be future), `allowDownload` (boolean, optional, default false).
- [ ] **(3.8b)** Create `src/share/dto/share-link-response.dto.ts`: Zod schema — `id`, `projectId`, `shareToken`, `expiresAt`, `allowDownload`, `createdAt`. Exclude `passwordHash`.
- [ ] **(3.8c)** Create `src/share/share.service.ts` with `PrismaService` and `ProjectService`. Method:
  - `createShareLink(projectId, userId, dto)`: verify ownership. Generate 32-byte token via `crypto.randomBytes(32).toString('base64url')`. Create `ShareLink`. Return response without hash.
- [ ] **(3.9a)** Add `accessSharedProject(token)` method to `ShareService`:
  1. Find `ShareLink` by `shareToken`. Throw 404 if not found.
  2. Check expiration. Throw 404 if expired.
  3. If `passwordHash` set → return `{ requiresPassword: true }`.
  4. Load latest completed version. Return `{ title, videoUrl, allowDownload, createdAt }`. Do NOT expose userId/projectId.
- [ ] **(3.9b)** Create `src/share/dto/shared-project-response.dto.ts`: Zod schema — `title`, `videoUrl`, `allowDownload`, `requiresPassword`, `createdAt`.
- [ ] **(3.9c)** Create `src/share/share.controller.ts`:
  - **Authenticated** (`projects/:projectId/share`): `POST /` → create share link.
  - **Public** (`shared`): `GET /:token` → `accessSharedProject()`, decorated with `@Public()`.
  - Guard creation behind `FEATURE_SHARE_ENABLED` flag.
- [ ] **(3.10)** Create `src/share/share.module.ts`: declare `ShareController`, provide `ShareService`, import `PrismaModule` and `ProjectModule`. Export `ShareService`.
  - Import `ShareModule` in `src/app.module.ts`.

#### Agent: `integration` — "workflow-extensions"

- [ ] **(3.5)** Add `cancelWorkflow(projectId, versionId, userId)` to `WorkflowService`:
  1. Verify ownership.
  2. Load execution, verify `running`.
  3. Verify version status is `analyzing` or `generating`. Throw `ConflictException` if not cancellable.
  4. Remove pending BullMQ jobs for this execution.
  5. Update pending/running `WorkflowStep` records to `skipped`.
  6. Update execution status to `cancelled`, set `completedAt`.
  7. Update `ProjectVersion.status` to `cancelled`.
  8. Publish `workflow.cancelled` NATS event.
  - Add `POST /cancel` endpoint to `WorkflowController`: return `200`.
- [ ] **(3.6)** Add `retryWorkflow(projectId, versionId, userId)` to `WorkflowService`:
  1. Verify ownership.
  2. Verify version status `failed`. Throw `ConflictException` otherwise.
  3. Check retry count against `maxRetries`. Throw `BadRequestException` if exceeded.
  4. Create new `WorkflowExecution` + `WorkflowStep` records (skip previously completed steps).
  5. Transition XState: `RETRY` (failed → analyzing).
  6. Update `ProjectVersion.status` to `analyzing`.
  7. Enqueue BullMQ job from the failed step.
  - Add `POST /retry` endpoint to `WorkflowController`: return `202`.
- [ ] **(3.7a)** Create `src/workflow/workflow.sse.controller.ts`:
  - `GET /progress/stream` — `@Sse()` returning `Observable<MessageEvent>`:
    1. Verify ownership.
    2. Emit initial state snapshot.
    3. Subscribe to internal `EventEmitter2`/RxJS Subject for `versionId` updates.
    4. On update → emit SSE event.
    5. On terminal state → complete Observable.
    6. Guard with `FEATURE_SSE_ENABLED`.
- [ ] **(3.7b)** Update `WorkflowService` to emit events via `EventEmitter2` on progress updates, step completions, and terminal states.
- [ ] **(3.7c)** Register `WorkflowSSEController` in `WorkflowModule`. Add `active_sse_connections` metric.
- [ ] **(3.11a)** Create `src/clients/notification-service.client.ts`: method `sendNotification({ userId, type, data })`: `POST .../notifications/send`. Retry 3×. **On failure: log warning but do NOT throw** (best-effort).
- [ ] **(3.11b)** Integrate into `WorkflowService`: on `completeWorkflow()` → send `generation_completed`; on `failWorkflow()` (retries exhausted) → send `generation_failed`.
- [ ] **(3.12)** Harden NATS subscriber handlers:
  - Validate all incoming payloads with Zod schemas. Nak invalid payloads.
  - Handle idempotency (skip duplicate `image.completed` for same scene).
  - Use Prisma transactions for multi-record updates.
  - Log each message at `info` with `{ subject, executionId, correlationId }`.
  - Implement dead-letter handling: log poison messages at `error`.
- [ ] **(3.15a)** Verify `LoggingInterceptor` extracts `X-Request-Id` and generates UUID if absent. Store as `correlationId` via `AsyncLocalStorage` or NestJS request scope.
- [ ] **(3.15b)** Update `UserServiceClient`: include `{ 'X-Request-Id': correlationId }` in all requests.
- [ ] **(3.15c)** Update `StorageServiceClient`: include `X-Request-Id`.
- [ ] **(3.15d)** Update `NotificationServiceClient`: include `X-Request-Id`.
- [ ] **(3.15e)** Verify `NatsPublisher` populates `correlationId` in every event payload.
- [ ] **(3.15f)** Verify Pino logs include `correlationId` on every log line.
- [ ] **(3.16a)** Ensure `app.enableShutdownHooks()` in `main.ts`.
- [ ] **(3.16b)** Implement `onModuleDestroy()` in `MessagingModule`: drain NATS subscriptions, close connection.
- [ ] **(3.16c)** Implement `onModuleDestroy()` in `WorkflowProcessor`: close BullMQ workers (`worker.close()`), close queue connections.
- [ ] **(3.16d)** Implement `onModuleDestroy()` in `PrismaService`: `$disconnect()`.
- [ ] **(3.16e)** Implement `onModuleDestroy()` for Redis connections.
- [ ] **(3.16f)** Test shutdown on `SIGTERM`: verify order — stop HTTP → drain BullMQ → drain NATS → disconnect Prisma → close Redis → exit.

#### Agent: `database` — "full-text-search"

- [ ] **(3.1a)** Create Prisma migration adding PostgreSQL full-text search:
  - Add `tsvector` generated column on `Project` (from `title`).
  - Add `tsvector` generated column on `ProjectContent` (from `text`).
  - Create GIN indexes on both columns.
- [ ] **(3.1b)** Add `search(userId, query, pagination)` to `ProjectService`:
  - Use `$queryRaw` for full-text search with `plainto_tsquery` + `ts_rank`.
  - Join `Project` with `ProjectContent`.
  - Filter by `userId` and `deletedAt IS NULL`.
  - Apply pagination (LIMIT/OFFSET). Return `PaginatedResponse`.
- [ ] **(3.1c)** Add `GET /search` endpoint to `ProjectController`: accept `q` (string, min 1, required) + pagination params. Guard with `FEATURE_SEARCH_ENABLED`. Return `200`.

#### Agent: `devops` — "observability-infra"

- [ ] **(3.13a)** Create metrics service/module using `prom-client`. Initialize `collectDefaultMetrics()`. Define custom metrics:
  - `http_requests_total` (Counter), `http_request_duration_seconds` (Histogram).
  - `workflow_executions_total` (Counter), `workflow_duration_seconds` (Histogram), `workflow_step_duration_seconds` (Histogram).
  - `bullmq_jobs_active` (Gauge), `bullmq_jobs_waiting` (Gauge), `bullmq_jobs_failed_total` (Counter).
  - `nats_messages_published_total` (Counter), `nats_messages_received_total` (Counter).
  - `prisma_query_duration_seconds` (Histogram), `active_sse_connections` (Gauge).
- [ ] **(3.13b)** Create `GET /metrics` endpoint (`@Public()`) returning Prometheus exposition format.
- [ ] **(3.13c)** Create `MetricsInterceptor` incrementing `http_requests_total` + observing duration. Register globally.
- [ ] **(3.13d)** Instrument `NatsPublisher` and `NatsSubscriber` with counters.
- [ ] **(3.13e)** Instrument `WorkflowService` with duration/count metrics.
- [ ] **(3.13f)** Instrument BullMQ: periodic queue count polling (every 10s).
- [ ] **(3.13g)** Instrument Prisma: middleware for `prisma_query_duration_seconds`.
- [ ] **(3.17a)** Create `helm/values-dev.yaml`: `replicaCount: 1`, `hpa: { min: 1, max: 2 }`, reduced resources, `LOG_LEVEL: debug`, `SWAGGER_ENABLED: "true"`.
- [ ] **(3.17b)** Create `helm/values-staging.yaml`: `replicaCount: 2`, `hpa: { min: 2, max: 5 }`, standard resources, `LOG_LEVEL: info`, `SWAGGER_ENABLED: "true"`.
- [ ] **(3.17c)** Create `helm/values-prod.yaml`: `replicaCount: 3`, `hpa: { min: 3, max: 10 }`, full resources, `LOG_LEVEL: info`, `SWAGGER_ENABLED: "false"`.

---

### Wave 13: API Documentation

> **Depends on**: Wave 12 (needs all modules registered, especially ShareModule from 3.10) | **Parallel agents: 1** | **Profiles**: `devops`

#### Agent: `devops` — "swagger-docs"

- [ ] **(3.14a)** Verify Swagger configured in `main.ts`: `DocumentBuilder().setTitle('core-project-service').setVersion('1.0').addApiKey({ type: 'apiKey', name: 'X-User-Id', in: 'header' }, 'gateway-auth').build()`.
- [ ] **(3.14b)** Add `@ApiTags('Projects')` to `ProjectController`.
- [ ] **(3.14c)** Add `@ApiTags('Content')` to `ContentController`.
- [ ] **(3.14d)** Add `@ApiTags('Versions')` to `VersionController`.
- [ ] **(3.14e)** Add `@ApiTags('Workflow')` to `WorkflowController` and `WorkflowSSEController`.
- [ ] **(3.14f)** Add `@ApiTags('Sharing')` to `ShareController`.
- [ ] **(3.14g)** Add `@ApiTags('Health')` to `HealthController`.
- [ ] **(3.14h)** Verify all endpoints appear in `/api/docs` with correct schemas. Guard behind `SWAGGER_ENABLED`.

---

### Wave 14: Extended Tests

> **Depends on**: Wave 13 | **Parallel agents: 2** | **Profiles**: `testing` ×2

#### Agent: `testing` — "p2-unit-tests"

- [ ] **(3.19a)** Create `test/unit/project/project-search.spec.ts`: mock `$queryRaw`. Tests: matching query, non-matching, pagination, feature flag disabled.
- [ ] **(3.19b)** Create `test/unit/content/content-summary.spec.ts`: getSummary — returns summary, null when not analyzed.
- [ ] **(3.19c)** Create `test/unit/content/scene-update.spec.ts`: updateScene — partial updates, 404 for non-existent, ownership verified.
- [ ] **(3.19d)** Create `test/unit/content/characters.spec.ts`: listCharacters — returns characters, empty array.
- [ ] **(3.19e)** Create `test/unit/workflow/workflow-cancel.spec.ts`: cancel transitions, removes jobs, publishes event, 409 when not cancellable.
- [ ] **(3.19f)** Create `test/unit/workflow/workflow-retry.spec.ts`: retry creates new execution, skips completed steps, enqueues from failed step, 409 when not failed, max retries error.
- [ ] **(3.19g)** Create `test/unit/workflow/workflow-sse.spec.ts`: SSE emits initial state, updates, closes on terminal, feature flag.
- [ ] **(3.19h)** Create `test/unit/share/share.service.spec.ts`: create (token generation, record), access (valid, expired, password-protected).
- [ ] **(3.19i)** Create `test/unit/clients/notification-service.client.spec.ts`: sendNotification — POST, retries, does NOT throw on exhaustion.
- [ ] **(3.19j)** Create `test/unit/common/metrics.spec.ts`: interceptor increments counters, endpoint returns valid Prometheus format.

#### Agent: `testing` — "e2e-tests"

- [ ] **(3.18a)** Create `test/e2e/setup.ts`: bootstrap full NestJS app with testcontainers. Apply migrations. Return app + supertest agent.
- [ ] **(3.18b)** Create test utility helpers:
  - `test/helpers/seed.ts`: factory functions `createTestProject()`, `createTestContent()`, `createTestScene()`, `createTestVersion()`, `createTestExecution()`.
  - `test/helpers/auth.ts`: `authenticatedRequest(agent, userId?)`, `unauthenticatedRequest(agent)`.
  - `test/helpers/nats.ts`: `publishMockEvent(subject, payload)`.
  - `test/helpers/bullmq.ts`: `waitForJobCompletion(queue, jobId, timeout?)`.
- [ ] **(3.18c)** Create `test/e2e/project.e2e.spec.ts`: create → 201, get → 200, list → pagination, update → 200, delete → 204 + subsequent GET → 404, no X-User-Id → 401, wrong user → 404, invalid body → 400, invalid UUID → 400.
- [ ] **(3.18d)** Create `test/e2e/content.e2e.spec.ts`: get → 200, update text → wordCount recalculated, list scenes → ordered, no scenes → empty array.
- [ ] **(3.18e)** Create `test/e2e/version.e2e.spec.ts`: create → 201 versionNumber=1, second → versionNumber=2, list → descending, get with executions → 200.
- [ ] **(3.18f)** Create `test/e2e/workflow.e2e.spec.ts`: start → 202, poll status → 200 with progress, simulate analysis complete via NATS → verify scenes/characters, full pipeline end-to-end, no content → 400, no quota → 403.
- [ ] **(3.18g)** Create `test/e2e/share.e2e.spec.ts`: create → 201, access via token → 200, expired → 404, invalid → 404, password-protected → requiresPassword.

---

## Phase 4 — Polish

> Advanced features, optimization, and edge cases.

---

### Wave 15: Polish Features

> **Depends on**: Wave 14 (Phase 3 complete) | **Parallel agents: 2** | **Profiles**: `backend`, `integration`

#### Agent: `backend` — "polish-features"

- [ ] **(4.1a)** Update `src/share/dto/create-share-link.dto.ts`: add optional `password` field (string, min 8 if provided).
- [ ] **(4.1b)** Update `ShareService.createShareLink()`: if `dto.password` provided, hash with `bcrypt` (work factor 12). Store hash. Return without password/hash.
- [ ] **(4.2a)** Create `src/share/dto/verify-password.dto.ts`: Zod schema — `password` (string, required).
- [ ] **(4.2b)** Add `verifySharePassword(token, password)` to `ShareService`:
  1. Find `ShareLink`. Throw 404 if not found.
  2. Check expiration. Throw 404 if expired.
  3. Verify `passwordHash` is not null. Throw 400 if not password-protected.
  4. `bcrypt.compare()`. On match → return shared project data. On mismatch → throw 401.
- [ ] **(4.2c)** Add `POST /shared/:token/verify` endpoint (`@Public()`): return `200` or `401`.
- [ ] **(4.3a)** Add `getShareLinkInfo(projectId, userId)` to `ShareService`: verify ownership. Return `{ id, projectId, shareToken, expiresAt, allowDownload, isPasswordProtected, createdAt }`.
- [ ] **(4.3b)** Add `GET /` to `ShareController` (authenticated): return `200`.
- [ ] **(4.4a)** Add `deleteShareLink(projectId, userId)` to `ShareService`: verify ownership. Hard-delete `ShareLink`. Throw 404 if none.
- [ ] **(4.4b)** Add `DELETE /` to `ShareController` (authenticated): return `204`.
- [ ] **(4.5a)** Add `compareVersions(projectId, v1Id, v2Id, userId)` to `VersionService`:
  1. Verify ownership. Load both versions. Throw 404 if either missing.
  2. Compute config diff: `added`, `removed`, `changed` keys.
- [ ] **(4.5b)** Create `src/version/dto/version-compare-response.dto.ts`.
- [ ] **(4.5c)** Add `GET /:v1/compare/:v2` to `VersionController`.
- [ ] **(4.6a)** Add `revertToVersion(projectId, versionId, userId)` to `VersionService`: verify ownership. Copy `version.config` to `Project.config`. Update `updatedAt`.
- [ ] **(4.6b)** Add `POST /:versionId/revert` to `VersionController`.
- [ ] **(4.10a)** Update `ProjectService` to auto-derive status: on first `VersionService.create()` → update project to `active`. Add `archiveProject(projectId, userId)` method.
- [ ] **(4.10b)** Add optional `status` filter to `findAllByUser` and `search` queries.

#### Agent: `integration` — "polish-infra"

- [ ] **(4.7a)** Create `CacheService` using `ioredis`. Methods: `get<T>(key)`, `set(key, value, ttlSeconds)`, `del(key)`, `delByPattern(pattern)`.
- [ ] **(4.7b)** Add caching to `ProjectService.findById()`: cache key `project:{id}`, TTL 300s. Invalidate on `update()` and `softDelete()`.
- [ ] **(4.7c)** Add caching to `ContentService.getContent()`: cache key `content:{projectId}`, TTL 300s. Invalidate on `updateContent()`.
- [ ] **(4.7d)** Add caching to `ContentService.getSummary()`: cache key `summary:{projectId}`, TTL 600s. Invalidate on analysis re-run.
- [ ] **(4.8a)** Install `sanitize-html` (+ `@types/sanitize-html` dev).
- [ ] **(4.8b)** Create `src/common/utils/sanitize.ts`: export `sanitizeText(input)` that strips HTML, scripts, iframes, event handlers. Preserves plain text.
- [ ] **(4.8c)** Apply sanitization in `ProjectService.create()` (title, content.text), `update()` (title), `ContentService.updateContent()` (text), `updateScene()` (text, description, imagePrompt).
- [ ] **(4.9a)** Create `src/common/interceptors/rate-limit-headers.interceptor.ts`: copy `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` from request to response headers.
- [ ] **(4.9b)** Register as global interceptor in `main.ts`.

---

### Wave 16: P3 Tests

> **Depends on**: Wave 15 | **Parallel agents: 1** | **Profiles**: `testing`

#### Agent: `testing` — "p3-unit-tests"

- [ ] **(4.11a)** Create `test/unit/share/share-password.spec.ts`: password-protected creation (bcrypt hash, work factor 12); verification (correct → data, incorrect → 401, expired → 404).
- [ ] **(4.11b)** Create `test/unit/share/share-crud.spec.ts`: getShareLinkInfo (metadata, `isPasswordProtected`); deleteShareLink (hard-delete, 404 when none).
- [ ] **(4.11c)** Create `test/unit/version/version-compare.spec.ts`: identical configs, added/removed/changed keys, nested changes.
- [ ] **(4.11d)** Create `test/unit/version/version-revert.spec.ts`: project config updated, `updatedAt` changed, 404 for non-existent.
- [ ] **(4.11e)** Create `test/unit/common/redis-cache.spec.ts`: mock ioredis. Test get/set/del/delByPattern. Test cache integration with findById.
- [ ] **(4.11f)** Create `test/unit/common/sanitize.spec.ts`: strips `<script>` (including content), `<iframe>`, event handlers; preserves text; handles nested tags, empty input.
- [ ] **(4.11g)** Create `test/unit/common/rate-limit-headers.spec.ts`: forwards all three headers; handles missing headers gracefully.
- [ ] **(4.11h)** Create `test/unit/project/project-status.spec.ts`: new project is `draft`; becomes `active` on first version; can be archived; `findAllByUser` respects filter.

---

## Summary

| Phase       | Waves | Description                                | Max Parallel Agents | Profiles Used                                         |
| ----------- | ----- | ------------------------------------------ | ------------------: | ----------------------------------------------------- |
| **Phase 1** | 1–5   | Foundation (scaffolding + P0 infra)        |                   3 | backend, database, devops, testing                    |
| **Phase 2** | 6–11  | Core MVP (CRUD, workflow, messaging)       |                   3 | backend ×2, integration, testing                      |
| **Phase 3** | 12–14 | Extended MVP (search, share, SSE, metrics) |                   5 | backend ×2, integration, database, devops, testing ×2 |
| **Phase 4** | 15–16 | Polish (passwords, cache, sanitization)    |                   2 | backend, integration, testing                         |

### Wave Execution Timeline

| Wave   | Depends On | Agents | Key Deliverables                                                                                                                                      |
| ------ | ---------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | —          |      2 | tsconfig, eslint, prettier, vitest, .env.example, docker-compose                                                                                      |
| **2**  | Wave 1     |      2 | Zod env config, CI pipeline, Dockerfile, Helm chart                                                                                                   |
| **3**  | Wave 2     |      3 | Prisma schema + PrismaModule, auth guard, validation pipe, exception filter, Pino logging                                                             |
| **4**  | Wave 3     |      1 | main.ts bootstrap, app.module.ts, health checks                                                                                                       |
| **5**  | Wave 4     |      1 | P0 unit tests (config, guard, pipe, filter, health)                                                                                                   |
| **6**  | Wave 5     |      2 | Project DTOs, NATS pub/sub, HTTP clients, XState machine, progress calc                                                                               |
| **7**  | Wave 6     |      2 | ProjectService + Controller + Module, BullMQ processor                                                                                                |
| **8**  | Wave 7     |      2 | Content module (full), Version module (full)                                                                                                          |
| **9**  | Wave 8     |      1 | WorkflowService + Controller + Module, NATS handler wiring                                                                                            |
| **10** | Wave 9     |      1 | P1 unit tests (project, content, version, workflow, messaging, clients)                                                                               |
| **11** | Wave 10    |      1 | P1 integration tests (PostgreSQL, Redis, NATS with testcontainers)                                                                                    |
| **12** | Wave 11    |      5 | Search, summary, scenes, characters, share links, SSE, cancel/retry, notification client, metrics, correlation ID, graceful shutdown, Helm env values |
| **13** | Wave 12    |      1 | Swagger/OpenAPI documentation for all endpoints                                                                                                       |
| **14** | Wave 13    |      2 | P2 unit tests + E2E tests with testcontainers                                                                                                         |
| **15** | Wave 14    |      2 | Password shares, version compare/revert, Redis cache, sanitization, rate limit headers, status tracking                                               |
| **16** | Wave 15    |      1 | P3 unit tests                                                                                                                                         |

### Task Count

| Phase                  | Sections | Approx. Tasks |
| ---------------------- | -------- | ------------- |
| Phase 1 (Foundation)   | 16       | ~65           |
| Phase 2 (Core MVP)     | 15       | ~85           |
| Phase 3 (Extended MVP) | 17       | ~70           |
| Phase 4 (Polish)       | 11       | ~35           |
| **Total**              | **59**   | **~255**      |

### Critical Path

The longest sequential dependency chain limiting wall-clock time:

```
Wave 1 (tsconfig)
  → Wave 2 (env config)
    → Wave 3 (prisma + auth)
      → Wave 4 (bootstrap)
        → Wave 6 (DTOs + NATS)
          → Wave 7 (project module)
            → Wave 8 (content + version)
              → Wave 9 (workflow engine) ← BOTTLENECK
                → Wave 12 (extensions)
                  → Wave 15 (polish)
```

**10 sequential waves** on the critical path. All other work runs in parallel off this chain.

### File Contention Risks

| File                                  | Touched By                              | Mitigation                                                                                                       |
| ------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app.module.ts`                   | Multiple agents adding module imports   | Each agent adds its import in dedicated registration tasks (2.4, 2.9, 2.13, 2.25, 3.10). Avoid concurrent edits. |
| `src/main.ts`                         | Set up in Wave 4, rarely modified after | Only Wave 4 and minor additions (metrics interceptor in Wave 12).                                                |
| `src/workflow/workflow.service.ts`    | Integration Dev in Waves 9, 12          | Assigned to same agent profile.                                                                                  |
| `src/workflow/workflow.controller.ts` | Integration Dev in Waves 9, 12          | Assigned to same agent profile.                                                                                  |

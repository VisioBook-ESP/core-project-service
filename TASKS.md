# TASKS.md — core-project-service Implementation Checklist

> Derived from `ARCHITECTURE.md`. Each checkbox is an atomic, agent-dispatchable task.
> Organized by **Priority Matrix** (P0 → P3) and respects the **Dependency Matrix**.
> Cross-references (`§4`, `F-PM-01`) point to ARCHITECTURE.md sections and feature IDs.

---

## Table of Contents

- [Phase 0 — Project Scaffolding](#phase-0--project-scaffolding)
- [Phase 1 — P0 Foundational Infrastructure](#phase-1--p0-foundational-infrastructure)
- [Phase 2 — P1 Core MVP](#phase-2--p1-core-mvp)
- [Phase 3 — P2 Extended MVP](#phase-3--p2-extended-mvp)
- [Phase 4 — P3 Polish](#phase-4--p3-polish)

---

## Phase 0 — Project Scaffolding

> Initialize the Node.js project, install every dependency, configure TypeScript and tooling, create the local development environment. No business logic yet.

### 0.1 Node.js Project Initialization

- [ ] Run `pnpm init` to create `package.json`. Set `name` to `core-project-service`, `version` to `0.1.0`, `private` to `true`, `type` to `module`, `engines.node` to `>=22`.
- [ ] Install NestJS core packages: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`.
- [ ] Install TypeScript and build tooling: `typescript`, `ts-node`, `tsconfig-paths`, `@types/node` (dev).
- [ ] Install Prisma ORM: `prisma` (dev), `@prisma/client`.
- [ ] Install BullMQ and NestJS integration: `bullmq`, `@nestjs/bullmq`, `ioredis`.
- [ ] Install XState v5: `xstate`.
- [ ] Install Zod, NestJS-Zod, and Swagger: `zod`, `nestjs-zod`, `@nestjs/swagger`, `swagger-ui-express`.
- [ ] Install Pino logging: `pino`, `pino-http`, `nestjs-pino`.
- [ ] Install health checks: `@nestjs/terminus`.
- [ ] Install Prometheus metrics: `prom-client`.
- [ ] Install HTTP client: `@nestjs/axios`, `axios`.
- [ ] Install NATS client: `nats`.
- [ ] Install security utilities: `bcrypt`, `@types/bcrypt` (dev).
- [ ] Install dev/test dependencies: `vitest`, `@vitest/coverage-v8`, `testcontainers`, `supertest`, `@types/supertest`, `eslint`, `prettier`, `eslint-config-prettier`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`.
- [ ] Add `scripts` to `package.json`:
  - `build`: compile TypeScript (`tsc -p tsconfig.json`)
  - `start`: run production (`node dist/main.js`)
  - `start:dev`: run dev mode with watch (`ts-node --esm -r tsconfig-paths/register src/main.ts` or NestJS CLI)
  - `lint`: ESLint check (`eslint "src/**/*.ts" "test/**/*.ts"`)
  - `format`: Prettier check (`prettier --check "src/**/*.ts" "test/**/*.ts"`)
  - `typecheck`: type-only check (`tsc --noEmit`)
  - `test:unit`: unit tests (`vitest run --config vitest.config.ts --project unit`)
  - `test:integration`: integration tests (`vitest run --config vitest.config.ts --project integration`)
  - `test:e2e`: end-to-end tests (`vitest run --config vitest.config.ts --project e2e`)
  - `prisma:generate`: `prisma generate`
  - `prisma:migrate`: `prisma migrate dev`
  - `prisma:migrate:deploy`: `prisma migrate deploy`

### 0.2 TypeScript Configuration

- [ ] Create `tsconfig.json` with: `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `outDir: "dist"`, `rootDir: "src"`, `declaration: true`, `esModuleInterop: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`. Add paths alias `"@/*": ["src/*"]`. Exclude `node_modules`, `dist`, `test`.

### 0.3 Developer Tooling

- [ ] Create `.eslintrc.cjs`: extend `["@typescript-eslint/recommended", "prettier"]`, parser `@typescript-eslint/parser`, parserOptions `{ project: "tsconfig.json" }`. Enable rules relevant to NestJS (no-unused-vars as warn, explicit-function-return-type off).
- [ ] Create `.prettierrc`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true, "tabWidth": 2 }`.
- [ ] Create `vitest.config.ts`: globals `true`, root `./`. Define three project configurations:
  - `unit`: include `test/unit/**/*.spec.ts`
  - `integration`: include `test/integration/**/*.integration.spec.ts`
  - `e2e`: include `test/e2e/**/*.e2e.spec.ts`
  Coverage provider `v8`. Pool `forks` (testcontainers compatibility). Aliases `@/` → `src/`.

### 0.4 Environment Variable Template

- [ ] Create `.env.example` documenting every variable from §16 with descriptive comments and placeholder values:
  - **Application**: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `SWAGGER_ENABLED`, `CORS_ORIGINS`
  - **Database**: `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`
  - **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS_ENABLED`
  - **NATS**: `NATS_URL`, `NATS_USER`, `NATS_PASSWORD`, `NATS_STREAM_NAME`
  - **BullMQ**: `BULLMQ_CONCURRENCY`, `BULLMQ_MAX_RETRIES`
  - **External services**: `USER_SERVICE_URL`, `STORAGE_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `HTTP_CLIENT_TIMEOUT`
  - **Feature flags**: `FEATURE_SSE_ENABLED`, `FEATURE_SHARE_ENABLED`, `FEATURE_SEARCH_ENABLED`

### 0.5 Local Development Environment

- [ ] Create `docker-compose.dev.yml` with three services:
  - `postgres`: image `postgres:16-alpine`, port `5432:5432`, env `POSTGRES_DB=visiobook_project`, `POSTGRES_USER=dev`, `POSTGRES_PASSWORD=dev`, volume `pgdata` for persistence.
  - `redis`: image `redis:7-alpine`, port `6379:6379`.
  - `nats`: image `nats:2.10-alpine`, port `4222:4222` (client) + `8222:8222` (monitoring), command `--jetstream --store_dir /data`, volume `natsdata`.
- [ ] Update `.gitignore`: ensure it includes `node_modules/`, `dist/`, `.env`, `coverage/`, `*.tgz`, `.turbo/`.

---

## Phase 1 — P0 Foundational Infrastructure

> Build the mandatory foundation every other feature depends on: configuration, database schema, logging, auth guard, validation, health checks, CI/CD, and Helm charts. (§6 P0)

### 1.1 Environment Configuration — F-IF-07 (§16)

> **Deps**: Phase 0 complete

- [ ] Create `src/common/config/app.config.ts`: define a Zod schema (`envSchema`) validating every environment variable from §16:
  - **Application**: `NODE_ENV` (enum `development|staging|production`, default `development`), `PORT` (number, default `8086`), `LOG_LEVEL` (enum `trace|debug|info|warn|error|fatal`, default `info`), `SWAGGER_ENABLED` (boolean coerced from string, default `true`), `CORS_ORIGINS` (string, default `*`).
  - **Database**: `DATABASE_URL` (string, required, starts with `postgresql://`), `DATABASE_POOL_MIN` (number, default `2`), `DATABASE_POOL_MAX` (number, default `10`).
  - **Redis**: `REDIS_HOST` (string, required), `REDIS_PORT` (number, default `6379`), `REDIS_PASSWORD` (string, optional), `REDIS_DB` (number, default `0`), `REDIS_TLS_ENABLED` (boolean, default `false`).
  - **NATS**: `NATS_URL` (string, required, e.g. `nats://localhost:4222`), `NATS_USER` (string, optional), `NATS_PASSWORD` (string, optional), `NATS_STREAM_NAME` (string, default `VISIOBOOK_PROJECT`).
  - **BullMQ**: `BULLMQ_CONCURRENCY` (number, default `5`), `BULLMQ_MAX_RETRIES` (number, default `3`).
  - **External services**: `USER_SERVICE_URL` (string, required), `STORAGE_SERVICE_URL` (string, required), `NOTIFICATION_SERVICE_URL` (string, required), `HTTP_CLIENT_TIMEOUT` (number, default `5000`).
  - **Feature flags**: `FEATURE_SSE_ENABLED` (boolean, default `true`), `FEATURE_SHARE_ENABLED` (boolean, default `true`), `FEATURE_SEARCH_ENABLED` (boolean, default `true`).
- [ ] Export a `validateEnv()` function that parses `process.env` against the schema, throws a descriptive error listing all invalid/missing fields on failure (fail-fast), and returns the typed config object.
- [ ] Export inferred TypeScript type `AppConfig = z.infer<typeof envSchema>`.
- [ ] Create a NestJS config module (using `@nestjs/config` with custom `validate` function or a custom provider) that makes the validated `AppConfig` injectable throughout the application via `@Inject('APP_CONFIG')` or `ConfigService`.

### 1.2 Prisma Schema & Initial Migration (§4)

> **Deps**: 1.1 (needs `DATABASE_URL`)

- [ ] Create `prisma/schema.prisma`: set `datasource db` with provider `postgresql` and url `env("DATABASE_URL")`. Set `generator client` with provider `prisma-client-js`.
- [ ] Define enum `ProjectStatus` with values `draft`, `active`, `archived`.
- [ ] Define enum `SourceType` with values `file`, `scan`, `text`.
- [ ] Define enum `VersionStatus` with values `draft`, `analyzing`, `analyzed`, `configuring`, `generating`, `completed`, `failed`, `cancelled`.
- [ ] Define enum `ExecutionStatus` with values `pending`, `running`, `completed`, `failed`, `cancelled`.
- [ ] Define enum `PipelineStep` with values `analysis`, `scene_extraction`, `character_extraction`, `image_generation`, `audio_generation`, `assembly`.
- [ ] Define enum `StepStatus` with values `pending`, `running`, `completed`, `failed`, `skipped`.
- [ ] Define `Project` model with fields: `id` (String, @id, @default(uuid())), `userId` (String), `title` (String), `status` (ProjectStatus, @default(draft)), `sourceType` (SourceType), `config` (Json, @default("{}")), `createdAt` (DateTime, @default(now())), `updatedAt` (DateTime, @updatedAt), `deletedAt` (DateTime?). Add relations: `content ProjectContent?`, `scenes Scene[]`, `characters Character[]`, `versions ProjectVersion[]`, `shareLinks ShareLink[]`, `executions WorkflowExecution[]`. Add indexes: `@@index([userId])`, `@@index([deletedAt])`.
- [ ] Define `ProjectContent` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String, @unique), `text` (String), `wordCount` (Int), `summary` (String?), `metadata` (Json, @default("{}")). Add relation: `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`.
- [ ] Define `Scene` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String), `order` (Int), `text` (String), `description` (String), `imagePrompt` (String), `generatedImageUrl` (String?), `duration` (Float), `sentiment` (String?). Add relation to Project (onDelete: Cascade). Add `@@index([projectId])`, `@@unique([projectId, order])`.
- [ ] Define `Character` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String), `name` (String), `description` (String), `aliases` (String[]), `traits` (String[]). Add relation to Project (onDelete: Cascade). Add `@@index([projectId])`.
- [ ] Define `ProjectVersion` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String), `versionNumber` (Int), `config` (Json), `status` (VersionStatus, @default(draft)), `videoUrl` (String?), `createdAt` (DateTime, @default(now())). Add relation to Project (onDelete: Cascade). Add relations: `executions WorkflowExecution[]`. Add `@@index([projectId])`, `@@unique([projectId, versionNumber])`.
- [ ] Define `WorkflowExecution` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String), `versionId` (String), `status` (ExecutionStatus, @default(pending)), `currentStep` (String?), `progress` (Int, @default(0)), `startedAt` (DateTime?), `completedAt` (DateTime?), `error` (Json?). Add relations to Project (onDelete: Cascade) and ProjectVersion (onDelete: Cascade). Add relations: `steps WorkflowStep[]`. Add `@@index([versionId])`.
- [ ] Define `WorkflowStep` model with fields: `id` (String, @id, @default(uuid())), `executionId` (String), `step` (PipelineStep), `status` (StepStatus, @default(pending)), `progress` (Int, @default(0)), `details` (Json?), `startedAt` (DateTime?), `completedAt` (DateTime?). Add relation to WorkflowExecution (onDelete: Cascade). Add `@@index([executionId])`.
- [ ] Define `ShareLink` model with fields: `id` (String, @id, @default(uuid())), `projectId` (String), `shareToken` (String, @unique), `passwordHash` (String?), `expiresAt` (DateTime?), `allowDownload` (Boolean, @default(false)), `createdAt` (DateTime, @default(now())). Add relation to Project (onDelete: Cascade). Add `@@index([projectId])`.
- [ ] Run `npx prisma migrate dev --name init` to generate and apply the initial migration. Verify all tables, enums, indexes, and unique constraints are created correctly.
- [ ] Run `npx prisma generate` to produce the typed Prisma Client.
- [ ] Create a `PrismaService` (or use `@prisma/client` directly via a NestJS provider): extend `PrismaClient`, implement `onModuleInit()` to call `$connect()` and `onModuleDestroy()` to call `$disconnect()`. Export from a `PrismaModule` (global module).

### 1.3 Structured JSON Logging — F-IF-03 (§15)

> **Deps**: 1.1

- [ ] Configure `nestjs-pino` `LoggerModule` in `AppModule`:
  - Pino transport: stdout in JSON format.
  - Log level from `AppConfig.LOG_LEVEL`.
  - Auto-logging enabled (`autoLogging: true`) for request/response pairs.
  - Redact sensitive paths: `["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"]`.
  - Custom serializers to include `correlationId`, `userId`, `method`, `path`, `statusCode`, `responseTime` on every log line.
- [ ] Create `src/common/interceptors/logging.interceptor.ts`: NestJS `NestInterceptor` that:
  - Extracts `X-Request-Id` from request headers (or generates UUID if absent) and stores as `correlationId`.
  - Extracts `X-User-Id` from request headers and stores as `userId`.
  - Logs request start: `{ correlationId, userId, method, path }` at `info` level.
  - Logs response completion: `{ correlationId, userId, method, path, statusCode, responseTime }` at `info` level.
  - Attaches `correlationId` to the request object for downstream use.
- [ ] Register `LoggingInterceptor` as a global interceptor in `src/main.ts`.

### 1.4 Gateway Auth Guard — F-SV-01 (§17)

> **Deps**: 1.1

- [ ] Create `src/common/decorators/public.decorator.ts`: define `@Public()` decorator using `SetMetadata('isPublic', true)` to mark routes that skip authentication.
- [ ] Create `src/common/guards/gateway-auth.guard.ts`: NestJS `CanActivate` guard that:
  - Checks for `@Public()` metadata — if present, return `true` (skip auth).
  - Extracts `X-User-Id` header from the request.
  - Validates it is a non-empty string in UUID format.
  - Returns `true` if valid; throws `UnauthorizedException` (`401`) if missing or invalid.
- [ ] Create `src/common/decorators/current-user.decorator.ts`: NestJS `createParamDecorator` that extracts `X-User-Id` from request headers and returns it as a string. Usage: `@CurrentUser() userId: string`.
- [ ] Register `GatewayAuthGuard` as global guard in `AppModule` via `APP_GUARD` provider.

### 1.5 Zod Validation Pipe — F-SV-02 (§17)

> **Deps**: 1.1

- [ ] Create `src/common/pipes/zod-validation.pipe.ts`: NestJS `PipeTransform` using `nestjs-zod`. On validation failure, throw `BadRequestException` with standardized body: `{ statusCode: 400, message: "Validation failed", errors: [{ field: string, message: string }] }`. Integrate with `@nestjs/swagger` for automatic OpenAPI schema generation from Zod DTOs.
- [ ] Register as global pipe in `src/main.ts` (`app.useGlobalPipes(...)`).

### 1.6 HTTP Exception Filter & Shared Types

> **Deps**: 1.1

- [ ] Create `src/common/filters/http-exception.filter.ts`: NestJS `ExceptionFilter<HttpException>` that formats all error responses as `{ statusCode, message, error, timestamp, path }`. Log 4xx errors at `warn` level, 5xx at `error` level via Pino.
- [ ] Create `src/common/types/index.ts`: define and export shared types:
  - `PaginatedResponse<T>`: `{ items: T[], total: number, page: number, pageSize: number, totalPages: number }`.
  - `ApiErrorResponse`: `{ statusCode: number, message: string, error: string, timestamp: string, path: string }`.
  - Re-export relevant Prisma enums (`ProjectStatus`, `SourceType`, `VersionStatus`, `ExecutionStatus`, `PipelineStep`, `StepStatus`).
- [ ] Register `HttpExceptionFilter` as global filter in `src/main.ts`.

### 1.7 NestJS Application Bootstrap

> **Deps**: 1.1 — 1.6

- [ ] Create `src/main.ts`:
  1. Call `validateEnv()` at the top of the bootstrap function (fail-fast on invalid config).
  2. Create NestJS application (`NestFactory.create(AppModule)`).
  3. Enable CORS with `origin` from `AppConfig.CORS_ORIGINS` (split comma-separated string).
  4. Set global prefix `/api/v1` — exclude `/health` and `/metrics` routes from the prefix.
  5. Apply global pipes: `ZodValidationPipe`.
  6. Apply global filters: `HttpExceptionFilter`.
  7. Apply global interceptors: `LoggingInterceptor`.
  8. Configure Swagger conditionally (`if (config.SWAGGER_ENABLED)`) — `SwaggerModule.setup('api/docs', ...)` with title `core-project-service`, version `1.0`.
  9. Enable shutdown hooks (`app.enableShutdownHooks()`).
  10. Listen on `AppConfig.PORT`. Log `"core-project-service listening on port ${port}"`.
- [ ] Create `src/app.module.ts`: root `AppModule` importing:
  - `LoggerModule` (nestjs-pino) — configured in 1.3.
  - Custom `ConfigModule` — from 1.1.
  - `PrismaModule` — from 1.2.
  - `HealthModule` — from 1.8.
  - Global guard provider `{ provide: APP_GUARD, useClass: GatewayAuthGuard }`.
  - (Feature modules added in later phases.)

### 1.8 Health Check Endpoints — F-IF-01 (§15)

> **Deps**: 1.7

- [ ] Create `src/health/health.module.ts`: NestJS module using `@nestjs/terminus`. Define `HealthController` with two endpoints:
  - `GET /health/ready` (decorated with `@Public()`): readiness probe checking:
    - PostgreSQL connectivity via Prisma `$queryRaw(SELECT 1)`.
    - Redis connectivity via `ioredis` ping.
    - NATS connection status (connected/disconnected).
    Return `200` with `{ status: "ok", checks: {...} }` if all pass, `503` with failed checks if any fail.
  - `GET /health/live` (decorated with `@Public()`): liveness probe — always returns `200` with `{ status: "ok" }`.
- [ ] Import `HealthModule` in `AppModule`.

### 1.9 GitHub Actions CI Pipeline — F-CD-01 (§12)

> **Deps**: Phase 0 complete

- [ ] Create `.github/workflows/ci.yml` triggered on pull requests targeting `dev`:
  1. **install**: checkout repo, setup Node.js 22, setup pnpm, run `pnpm install --frozen-lockfile`, cache `node_modules` and pnpm store.
  2. **lint**: run `pnpm lint` (ESLint) and `pnpm format` (Prettier check). Depends on `install`.
  3. **typecheck**: run `pnpm typecheck` (`tsc --noEmit`). Depends on `install`.
  4. **test-unit**: run `pnpm test:unit` with coverage reporting. Depends on `install`.
  5. **test-integration**: run `pnpm test:integration`. Requires Docker (testcontainers). Depends on `install`.
  6. **test-e2e**: run `pnpm test:e2e`. Requires Docker (testcontainers). Depends on `test-integration`.
  7. **docker-build**: run `docker build .` to verify image builds. Depends on `install`.
  All jobs: Ubuntu latest runner, timeout 15 minutes.
- [ ] Create `.github/workflows/release.yml` triggered on push to `dev`:
  1. Build multi-stage Docker image.
  2. Tag with `${{ github.sha }}` and `dev-latest`.
  3. Login to GitHub Container Registry (`ghcr.io`) using `GITHUB_TOKEN`.
  4. Push image to `ghcr.io/visiobook/core-project-service`.

### 1.10 Docker Multi-Stage Build — F-CD-02 (§12)

> **Deps**: Phase 0 complete

- [ ] Create `Dockerfile`:
  - **Stage 1 — `builder`**: `FROM node:22-alpine AS builder`. Install pnpm globally. Set workdir `/app`. Copy `package.json`, `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile`. Copy `prisma/`. Run `pnpm prisma generate`. Copy `src/`, `tsconfig.json`. Run `pnpm build`.
  - **Stage 2 — `production`**: `FROM node:22-alpine`. Install pnpm globally. Set workdir `/app`. Copy `package.json`, `pnpm-lock.yaml`. Run `pnpm install --frozen-lockfile --prod`. Copy `--from=builder /app/dist ./dist`. Copy `--from=builder /app/prisma ./prisma`. Copy `--from=builder /app/node_modules/.prisma ./node_modules/.prisma`. Set `ENV NODE_ENV=production`. Expose `8086`. Add non-root user (`adduser -D appuser && chown -R appuser /app`). Switch to `USER appuser`. Set `CMD ["node", "dist/main.js"]`.
- [ ] Create `.dockerignore`: `node_modules`, `dist`, `.git`, `test`, `coverage`, `.env`, `*.md`, `.github`, `helm`, `.vscode`, `.idea`.

### 1.11 Helm Chart — F-CD-03 (§13)

> **Deps**: Phase 0 complete

- [ ] Create `helm/Chart.yaml`: `apiVersion: v2`, `name: core-project-service`, `version: 0.1.0`, `appVersion: "0.1.0"`, `type: application`, `description: "Core project service for VisioBook"`.
- [ ] Create `helm/values.yaml` with all base values from §13:
  ```yaml
  image:
    repository: ghcr.io/visiobook/core-project-service
    tag: ""
    pullPolicy: IfNotPresent
  replicaCount: 2
  resources:
    requests: { cpu: 250m, memory: 256Mi }
    limits: { cpu: 1000m, memory: 512Mi }
  env:
    NODE_ENV: production
    PORT: "8086"
    LOG_LEVEL: info
  probes:
    readiness: { path: /health/ready, initialDelaySeconds: 10 }
    liveness: { path: /health/live, initialDelaySeconds: 15 }
  hpa:
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilization: 70
  serviceMonitor:
    enabled: true
    interval: 30s
  ```
- [ ] Create `helm/templates/deployment.yaml`: Kubernetes Deployment with container spec referencing image from values, environment variables from ConfigMap (`envFrom: configMapRef`) and Secret (`envFrom: secretRef`), readiness and liveness probes, resource requests/limits from values, pod labels for service selector.
- [ ] Create `helm/templates/service.yaml`: ClusterIP Service on port `8086`, selector matching Deployment pod labels.
- [ ] Create `helm/templates/configmap.yaml`: ConfigMap holding non-secret env vars: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `NATS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `USER_SERVICE_URL`, `STORAGE_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `BULLMQ_CONCURRENCY`, `BULLMQ_MAX_RETRIES`, `SWAGGER_ENABLED`, `CORS_ORIGINS`, `FEATURE_SSE_ENABLED`, `FEATURE_SHARE_ENABLED`, `FEATURE_SEARCH_ENABLED`.
- [ ] Create `helm/templates/secret.yaml`: Secret placeholder with keys `DATABASE_URL`, `REDIS_PASSWORD`, `NATS_USER`, `NATS_PASSWORD`. Values to be populated by external secrets operator. Add annotation for external-secrets if applicable.
- [ ] Create `helm/templates/hpa.yaml`: HorizontalPodAutoscaler targeting the Deployment, `minReplicas`/`maxReplicas`/`targetCPUUtilizationPercentage` from values.
- [ ] Create `helm/templates/servicemonitor.yaml`: Prometheus ServiceMonitor selecting the Service by label, scraping port `8086` at path `/metrics`, interval from values. Include `enabled` conditional (`{{- if .Values.serviceMonitor.enabled }}`).

### 1.12 P0 Unit Tests

> **Deps**: 1.1 — 1.8

- [ ] Create directory structure: `test/unit/common/`, `test/unit/health/`.
- [ ] Create `test/unit/common/app-config.spec.ts`: test `validateEnv()` — valid full config returns typed object; missing required `DATABASE_URL` throws; missing required `REDIS_HOST` throws; defaults applied for optional vars (`PORT`=8086, `LOG_LEVEL`=info, etc.); invalid types rejected (e.g., `PORT="abc"`).
- [ ] Create `test/unit/common/gateway-auth-guard.spec.ts`: mock `ExecutionContext`. Test: valid UUID in `X-User-Id` passes; missing header throws 401; empty string throws 401; non-UUID string throws 401; route with `@Public()` metadata bypasses guard.
- [ ] Create `test/unit/common/zod-validation-pipe.spec.ts`: test pipe with a sample Zod schema — valid input passes through; invalid input throws `BadRequestException` with field-level errors array; extra fields stripped (strict mode).
- [ ] Create `test/unit/common/http-exception-filter.spec.ts`: mock `ArgumentsHost`. Test: `HttpException(400)` produces `{ statusCode: 400, message, error, timestamp, path }`; logs 4xx at warn; logs 5xx at error; unknown exceptions become 500.
- [ ] Create `test/unit/health/health.spec.ts`: mock Prisma, Redis, NATS. Test: all healthy → 200 with all checks ok; DB down → 503 with DB check failed; Redis down → 503; NATS down → 503; live endpoint always 200.

---

## Phase 2 — P1 Core MVP

> Core user-facing features: project CRUD, content management, version management, workflow engine, messaging, and HTTP clients. (§6 P1)

### 2.1 Project Module — DTOs (F-PM-01 through F-PM-05, §8)

> **Deps**: Phase 1 complete

- [ ] Create `src/project/dto/create-project.dto.ts`: Zod schema `CreateProjectDto`:
  - `title`: string, min 1, max 200.
  - `sourceType`: enum `file | scan | text`.
  - `config`: JSON object, optional, default `{}`.
  - `content`: object with `text` (string, min 1) and `metadata` (JSON, optional).
  Export `CreateProjectDtoType = z.infer<typeof CreateProjectDto>`. Register with `nestjs-zod` `createZodDto()` for Swagger.
- [ ] Create `src/project/dto/update-project.dto.ts`: Zod schema `UpdateProjectDto`:
  - `title`: string, min 1, max 200, optional.
  - `config`: JSON object, optional.
  All fields optional (partial update). Export type.
- [ ] Create `src/project/dto/project-response.dto.ts`: Zod schema `ProjectResponseDto`:
  - `id`, `userId`, `title`, `status`, `sourceType`, `config`, `createdAt`, `updatedAt`.
  Export type. Used by controller to validate/shape outgoing responses.
- [ ] Create `src/project/dto/list-projects-query.dto.ts`: Zod schema for query parameters:
  - `page`: number, optional, default 1, min 1.
  - `pageSize`: number, optional, default 20, min 1, max 100.
  - `sortBy`: enum `createdAt | updatedAt`, optional, default `updatedAt`.
  - `sortOrder`: enum `asc | desc`, optional, default `desc`.
  Export type.

### 2.2 Project Service (F-PM-01 through F-PM-05)

> **Deps**: 2.1

- [ ] Create `src/project/project.service.ts` with `PrismaService` and `NatsPublisher` injected. Implement methods:
  - `create(userId: string, dto: CreateProjectDtoType)`: in a Prisma transaction, create `Project` (title, sourceType, config, userId, status=draft) and `ProjectContent` (text from dto.content.text, wordCount computed by splitting text on whitespace, metadata from dto.content.metadata). Return created project with content.
  - `findById(projectId: string, userId: string)`: query `Project` where `id = projectId AND userId = userId AND deletedAt = null`. If not found, throw `NotFoundException` (returns 404 — not 403 — to prevent enumeration per §17). Return project.
  - `findAllByUser(userId: string, query: ListProjectsQueryType)`: query `Project` where `userId = userId AND deletedAt = null`, ordered by `query.sortBy` in `query.sortOrder`, with `skip`/`take` pagination. Return `PaginatedResponse<Project>` with total count.
  - `update(projectId: string, userId: string, dto: UpdateProjectDtoType)`: call `findById` (ownership check). Check that no workflow is currently running by querying the latest `ProjectVersion` — if its status is `analyzing` or `generating`, throw `ConflictException` (409). Update allowed fields. Return updated project.
  - `softDelete(projectId: string, userId: string)`: call `findById` (ownership check). Set `deletedAt = new Date()`. Collect all storage keys (scene `generatedImageUrl`, version `videoUrl`). Publish `visiobook.project.deleted` NATS event with `{ projectId, userId, storageKeys, timestamp, correlationId }`. Return void.

### 2.3 Project Controller (F-PM-01 through F-PM-05, §8)

> **Deps**: 2.2

- [ ] Create `src/project/project.controller.ts` with route prefix `projects`. Inject `ProjectService`. Endpoints:
  - `POST /` → `createProject(@CurrentUser() userId, @Body() dto: CreateProjectDto)`: call `service.create()`, return `201` with project response.
  - `GET /` → `listProjects(@CurrentUser() userId, @Query() query: ListProjectsQueryDto)`: call `service.findAllByUser()`, return `200` with paginated list.
  - `GET /:id` → `getProject(@CurrentUser() userId, @Param('id', ParseUUIDPipe) id)`: call `service.findById()`, return `200`.
  - `PATCH /:id` → `updateProject(@CurrentUser() userId, @Param('id') id, @Body() dto: UpdateProjectDto)`: call `service.update()`, return `200`.
  - `DELETE /:id` → `deleteProject(@CurrentUser() userId, @Param('id') id)`: call `service.softDelete()`, return `204` (no content).

### 2.4 Project Module Registration

> **Deps**: 2.3

- [ ] Create `src/project/project.module.ts`: NestJS module declaring `ProjectController`, providing `ProjectService`. Import `PrismaModule`, `MessagingModule` (for NATS events on delete). Export `ProjectService` (needed by Content, Version, Workflow, Share modules).
- [ ] Import `ProjectModule` in `src/app.module.ts`.

### 2.5 Ownership Validation Helper — F-SV-05 (§17)

> **Deps**: 2.2

- [ ] Ensure `ProjectService.findById()` queries by both `id` AND `userId` so a non-owner gets the identical 404 response as a non-existent project. Verify there is no code path that leaks ownership information (no 403 responses).
- [ ] Export a convenience method `ensureOwnership(projectId: string, userId: string): Promise<Project>` from `ProjectService` that other modules call before performing any project-scoped operation. This is just an alias for `findById` but makes the intent explicit in calling code.

### 2.6 Content Module — DTOs (F-CM-01, F-CM-02, F-CM-04, §8)

> **Deps**: Phase 1, 2.4

- [ ] Create `src/content/dto/update-content.dto.ts`: Zod schema — `text` (string, min 1, optional), `metadata` (JSON, optional). Export type.
- [ ] Create `src/content/dto/content-response.dto.ts`: Zod schema — `id`, `projectId`, `text`, `wordCount`, `summary`, `metadata`. Export type.
- [ ] Create `src/content/dto/scene-response.dto.ts`: Zod schema — `id`, `projectId`, `order`, `text`, `description`, `imagePrompt`, `generatedImageUrl`, `duration`, `sentiment`. Export type.

### 2.7 Content Service (F-CM-01, F-CM-02, F-CM-04)

> **Deps**: 2.6, 2.5

- [ ] Create `src/content/content.service.ts` with `PrismaService` and `ProjectService` injected. Methods:
  - `getContent(projectId: string, userId: string)`: call `projectService.ensureOwnership(projectId, userId)`. Query `ProjectContent` by `projectId`. Throw `NotFoundException` if no content exists. Return content.
  - `updateContent(projectId: string, userId: string, dto)`: call `ensureOwnership`. Update `ProjectContent` with provided fields. If `text` is updated, recompute `wordCount` (split on whitespace, count). Return updated content.
  - `listScenes(projectId: string, userId: string)`: call `ensureOwnership`. Query all `Scene` records where `projectId` matches, ordered by `order ASC`. Return scene array.

### 2.8 Content Controller (F-CM-01, F-CM-02, F-CM-04, §8)

> **Deps**: 2.7

- [ ] Create `src/content/content.controller.ts` with route prefix `projects/:projectId/content`. Inject `ContentService`. Endpoints:
  - `GET /` → `getContent(@CurrentUser() userId, @Param('projectId') projectId)`: return `200` with content.
  - `PATCH /` → `updateContent(@CurrentUser() userId, @Param('projectId') projectId, @Body() dto)`: return `200` with updated content.
  - `GET /scenes` → `listScenes(@CurrentUser() userId, @Param('projectId') projectId)`: return `200` with scene array.

### 2.9 Content Module Registration

> **Deps**: 2.8

- [ ] Create `src/content/content.module.ts`: declare `ContentController`, provide `ContentService`, import `PrismaModule` and `ProjectModule`. Export `ContentService`.
- [ ] Import `ContentModule` in `src/app.module.ts`.

### 2.10 Version Module — DTOs (F-VM-01, F-VM-02, F-VM-03, §8)

> **Deps**: Phase 1, 2.4

- [ ] Create `src/version/dto/create-version.dto.ts`: Zod schema — `config` (JSON object, optional — if omitted, snapshots current project config). Export type.
- [ ] Create `src/version/dto/version-response.dto.ts`: Zod schema — `id`, `projectId`, `versionNumber`, `config`, `status`, `videoUrl`, `createdAt`. Optionally includes nested `executions` array (each with `steps` array) for the detail endpoint. Export type.

### 2.11 Version Service (F-VM-01, F-VM-02, F-VM-03)

> **Deps**: 2.10, 2.5

- [ ] Create `src/version/version.service.ts` with `PrismaService` and `ProjectService` injected. Methods:
  - `create(projectId: string, userId: string, dto?)`: call `ensureOwnership`. Determine next `versionNumber`: query max existing `versionNumber` for the project, add 1 (or 1 if first version). Snapshot config: use `dto.config` if provided, otherwise copy `Project.config`. Create `ProjectVersion` with status `draft`. Return version.
  - `listByProject(projectId: string, userId: string)`: call `ensureOwnership`. Return all `ProjectVersion` records ordered by `versionNumber DESC`.
  - `findById(projectId: string, versionId: string, userId: string)`: call `ensureOwnership`. Query `ProjectVersion` where `id = versionId AND projectId = projectId`, include `WorkflowExecution` records (include their `WorkflowStep` records). Throw `NotFoundException` if not found. Return version with nested executions and steps.

### 2.12 Version Controller (F-VM-01, F-VM-02, F-VM-03, §8)

> **Deps**: 2.11

- [ ] Create `src/version/version.controller.ts` with route prefix `projects/:projectId/versions`. Inject `VersionService`. Endpoints:
  - `POST /` → `createVersion(@CurrentUser() userId, @Param('projectId') projectId, @Body() dto?)`: return `201`.
  - `GET /` → `listVersions(@CurrentUser() userId, @Param('projectId') projectId)`: return `200` with version array.
  - `GET /:versionId` → `getVersion(@CurrentUser() userId, @Param('projectId') projectId, @Param('versionId') versionId)`: return `200` with version + executions + steps.

### 2.13 Version Module Registration

> **Deps**: 2.12

- [ ] Create `src/version/version.module.ts`: declare `VersionController`, provide `VersionService`, import `PrismaModule` and `ProjectModule`. Export `VersionService`.
- [ ] Import `VersionModule` in `src/app.module.ts`.

### 2.14 NATS Subject Constants (§10)

> **Deps**: Phase 1

- [ ] Create `src/messaging/subjects.ts` exporting all NATS subject string constants:
  - **Outbound (published by this service)**:
    - `PROJECT_WORKFLOW_STARTED = 'visiobook.project.workflow.started'`
    - `PROJECT_WORKFLOW_STEP_COMPLETED = 'visiobook.project.workflow.step_completed'`
    - `PROJECT_WORKFLOW_COMPLETED = 'visiobook.project.workflow.completed'`
    - `PROJECT_WORKFLOW_FAILED = 'visiobook.project.workflow.failed'`
    - `PROJECT_WORKFLOW_CANCELLED = 'visiobook.project.workflow.cancelled'`
    - `PROJECT_DELETED = 'visiobook.project.deleted'`
  - **Inbound (consumed from AI services)**:
    - `AI_ANALYSIS_COMPLETED = 'visiobook.ai.analysis.completed'`
    - `AI_ANALYSIS_FAILED = 'visiobook.ai.analysis.failed'`
    - `AI_MEDIA_IMAGE_COMPLETED = 'visiobook.ai.media.image.completed'`
    - `AI_MEDIA_AUDIO_COMPLETED = 'visiobook.ai.media.audio.completed'`
    - `AI_ASSEMBLY_COMPLETED = 'visiobook.ai.assembly.completed'`
    - `AI_ASSEMBLY_FAILED = 'visiobook.ai.assembly.failed'`
    - `AI_PROGRESS = 'visiobook.ai.progress'`
  - **Stream config**:
    - `STREAM_NAME = 'VISIOBOOK_PROJECT'`
    - `STREAM_SUBJECTS = 'visiobook.project.>'`
    - `CONSUMER_NAME = 'core-project-service'`
    - `CONSUMER_FILTER = 'visiobook.ai.>'`

### 2.15 NATS JetStream Publisher — F-IS-01 (§10, §11)

> **Deps**: 2.14, 1.1

- [ ] Create `src/messaging/nats.publisher.ts`: injectable `NatsPublisher` service. On `onModuleInit()`:
  1. Connect to NATS using `NATS_URL`, optional `NATS_USER`/`NATS_PASSWORD` from config.
  2. Obtain JetStream manager (`jetStreamManager()`).
  3. Ensure stream `VISIOBOOK_PROJECT` exists with config: subjects `['visiobook.project.>']`, retention `LimitsRetention`, storage `FileStorage`, max_bytes `1GB`, max_age `7 days` (nanos), discard `DiscardOld`, max_msg_size `1MB`, num_replicas from env (3 for prod, 1 for dev).
  4. Obtain JetStream client for publishing.
- [ ] Implement publish methods matching each outbound event from §10:
  - `publishWorkflowStarted(payload: WorkflowStartedEvent)`: publish JSON to `visiobook.project.workflow.started`. Await JetStream ack (5s timeout). Retry 3 times on failure. Log error on exhaustion.
  - `publishStepCompleted(payload: StepCompletedEvent)`: publish to `visiobook.project.workflow.step_completed`.
  - `publishWorkflowCompleted(payload: WorkflowCompletedEvent)`: publish to `visiobook.project.workflow.completed`.
  - `publishWorkflowFailed(payload: WorkflowFailedEvent)`: publish to `visiobook.project.workflow.failed`.
  - `publishWorkflowCancelled(payload: WorkflowCancelledEvent)`: publish to `visiobook.project.workflow.cancelled`.
  - `publishProjectDeleted(payload: ProjectDeletedEvent)`: publish to `visiobook.project.deleted`.
- [ ] Define TypeScript interfaces for each event payload matching §10 field tables (e.g., `WorkflowStartedEvent` with `projectId`, `versionId`, `executionId`, `userId`, `config`, `contentText`, `sceneCount`, `timestamp`, `correlationId`).

### 2.16 NATS JetStream Subscriber — F-IS-02 (§10)

> **Deps**: 2.14, 1.1

- [ ] Create `src/messaging/nats.subscriber.ts`: injectable `NatsSubscriber` service. On `onModuleInit()`:
  1. Connect to NATS (reuse connection from publisher or create separate).
  2. Obtain JetStream client.
  3. Add or update durable consumer `core-project-service` on stream `VISIOBOOK_PROJECT` with config: durable name `core-project-service`, ack policy `Explicit`, ack wait `30s`, max deliver `5`, filter subject `visiobook.ai.>`, deliver policy `All` on first bind.
  4. Start consuming messages in a loop.
- [ ] Route each incoming message to a handler based on subject:
  - `visiobook.ai.analysis.completed` → `handleAnalysisCompleted(data)`
  - `visiobook.ai.analysis.failed` → `handleAnalysisFailed(data)`
  - `visiobook.ai.media.image.completed` → `handleImageCompleted(data)`
  - `visiobook.ai.media.audio.completed` → `handleAudioCompleted(data)`
  - `visiobook.ai.assembly.completed` → `handleAssemblyCompleted(data)`
  - `visiobook.ai.assembly.failed` → `handleAssemblyFailed(data)`
  - `visiobook.ai.progress` → `handleProgress(data)`
- [ ] Each handler: parse JSON payload, validate required fields, call `msg.ack()` on success. On processing error, call `msg.nak()` (triggers redelivery up to max deliver). Log all received messages with subject and correlationId.
- [ ] Define TypeScript interfaces for each inbound event payload matching §10 field tables.
- [ ] Stub handler bodies with TODO comments — full implementations wired in 2.26.

### 2.17 Messaging Module Registration

> **Deps**: 2.15, 2.16

- [ ] Create `src/messaging/messaging.module.ts`: NestJS module providing `NatsPublisher` and `NatsSubscriber`. Import config module for connection settings. Implement `onModuleDestroy()` to drain NATS connections on shutdown. Export both services.
- [ ] Import `MessagingModule` in `src/app.module.ts`.

### 2.18 HTTP Client: core-user-service — F-IS-03 (§11)

> **Deps**: 1.1

- [ ] Create `src/clients/user-service.client.ts`: injectable `UserServiceClient` using `HttpService` from `@nestjs/axios`. Inject `USER_SERVICE_URL` and `HTTP_CLIENT_TIMEOUT` from config. Methods:
  - `checkQuota(userId: string): Promise<{ remaining: number; total: number }>`: `GET {USER_SERVICE_URL}/api/v1/users/{userId}/quota`. Timeout `5000ms`. Retry 3 times with exponential backoff (delays: 1s, 2s, 4s). On exhausted retries, throw `ServiceUnavailableException` (503).
  - `decrementQuota(userId: string): Promise<void>`: `POST {USER_SERVICE_URL}/api/v1/users/{userId}/quota/decrement`. Same retry/timeout strategy. Throw 503 on failure.
  - Include `X-Request-Id` header (correlationId) in all outbound requests.

### 2.19 HTTP Client: support-storage-service — F-IS-04 (§11)

> **Deps**: 1.1

- [ ] Create `src/clients/storage-service.client.ts`: injectable `StorageServiceClient` using `HttpService`. Inject `STORAGE_SERVICE_URL` from config. Methods:
  - `getUploadUrl(params: { filename: string; contentType: string }): Promise<{ url: string; key: string }>`: `POST {STORAGE_SERVICE_URL}/api/v1/storage/upload-url`. Timeout `10000ms`. Retry 3 times, exponential backoff. Throw 503 on exhaustion.
  - `deleteFile(key: string): Promise<void>`: `DELETE {STORAGE_SERVICE_URL}/api/v1/storage/files/{key}`. Same strategy.
  - `getFileMetadata(key: string): Promise<{ size: number; format: string; [key: string]: unknown }>`: `GET {STORAGE_SERVICE_URL}/api/v1/storage/files/{key}/metadata`. Same strategy.
  - Include `X-Request-Id` header in all outbound requests.

### 2.20 Workflow State Machine — F-WF-02 (§9)

> **Deps**: Phase 1

- [ ] Create `src/workflow/workflow.machine.ts`: define XState v5 state machine (`createMachine`) for project version lifecycle:
  - **Context type**: `{ projectId: string; versionId: string; executionId: string; hasContent: boolean; hasQuota: boolean; hasScenes: boolean; retryCount: number; maxRetries: number }`.
  - **States**: `draft`, `analyzing`, `analyzed`, `generating`, `completed`, `failed`, `cancelled`.
  - **Transitions**:
    - `draft` → `analyzing` on event `START_WORKFLOW` with guards `hasContent` AND `hasQuota`.
    - `analyzing` → `analyzed` on event `ANALYSIS_COMPLETE`.
    - `analyzing` → `failed` on event `ANALYSIS_FAILED`.
    - `analyzing` → `cancelled` on event `CANCEL`.
    - `analyzed` → `generating` on event `START_GENERATION` with guard `hasScenes`.
    - `generating` → `completed` on event `GENERATION_COMPLETE`.
    - `generating` → `failed` on event `GENERATION_FAILED`.
    - `generating` → `cancelled` on event `CANCEL`.
    - `failed` → `analyzing` on event `RETRY` with guard `isRetryAllowed` (retryCount < maxRetries).
  - **Guards** (implemented as pure functions):
    - `hasContent`: `(ctx) => ctx.hasContent === true`
    - `hasQuota`: `(ctx) => ctx.hasQuota === true`
    - `hasScenes`: `(ctx) => ctx.hasScenes === true`
    - `isRetryAllowed`: `(ctx) => ctx.retryCount < ctx.maxRetries`
  - Export machine definition, context type, and event types.

### 2.21 BullMQ Queue Setup & Processor — F-WF-03 (§9)

> **Deps**: 2.20, 1.1

- [ ] Configure BullMQ in `AppModule` (or `WorkflowModule`): register `BullModule.forRoot()` with Redis connection from config (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`). Register queue: `BullModule.registerQueue({ name: 'project-workflow' })`.
- [ ] Create `src/workflow/workflow.processor.ts`: BullMQ `@Processor('project-workflow')` with concurrency from `BULLMQ_CONCURRENCY`. Define job handler (`@Process()` or `process()`) that routes by job name:
  - **`workflow:analysis`**: receive `{ projectId, versionId, executionId, text, config }`. Update WorkflowStep `analysis` to `running`. Publish `visiobook.project.workflow.started` NATS event. (The actual AI work is done by external services — this job publishes the request and returns. The NATS subscriber handles the response.)
  - **`workflow:image-generation`**: receive `{ projectId, versionId, executionId, scenes }`. Update WorkflowStep `image_generation` to `running`. Publish NATS events for each scene's image generation request.
  - **`workflow:audio-generation`**: receive `{ projectId, versionId, executionId, scenes, config }`. Update WorkflowStep `audio_generation` to `running`. Publish NATS event for audio generation.
  - **`workflow:assembly`**: receive `{ projectId, versionId, executionId }`. Update WorkflowStep `assembly` to `running`. Publish NATS event for video assembly.
  - Configure per-job defaults: `attempts` = `BULLMQ_MAX_RETRIES` (3), `backoff` = `{ type: 'exponential', delay: 1000 }` (1s → 4s → 16s), `timeout` = 300000 (5 min), `stalledInterval` = 30000 (30s).
- [ ] Implement `@OnWorkerEvent('failed')` handler: log job failure details including job name, attempt number, and error.

### 2.22 Workflow Service (F-WF-01, F-WF-04, F-WF-09)

> **Deps**: 2.20, 2.21, 2.15, 2.18, 2.5

- [ ] Create `src/workflow/workflow.service.ts` with dependencies: `PrismaService`, `Queue` (BullMQ `project-workflow` queue), `NatsPublisher`, `UserServiceClient`, `ProjectService`, `ContentService`. Implement methods:

  - **`startWorkflow(projectId, versionId, userId)`** — F-WF-01, F-WF-09:
    1. Call `projectService.ensureOwnership(projectId, userId)`.
    2. Load `ProjectVersion` by `versionId` and `projectId`. Verify status is `draft` (or `failed` for retry path). Throw `ConflictException` if already running.
    3. Load `ProjectContent`. Verify `text` is non-empty (`hasContent` guard). Throw `BadRequestException` if empty.
    4. Call `userServiceClient.checkQuota(userId)`. Verify `remaining > 0` (`hasQuota` guard). Throw `ForbiddenException` if no quota.
    5. Create `WorkflowExecution` record with status `pending`, `projectId`, `versionId`.
    6. Create `WorkflowStep` records for each pipeline step: `analysis`, `scene_extraction`, `character_extraction`, `image_generation`, `audio_generation`, `assembly` — all with status `pending`.
    7. Interpret XState machine with initial context, send `START_WORKFLOW` event. Verify transition to `analyzing`.
    8. Update `ProjectVersion.status` to `analyzing`.
    9. Update `WorkflowExecution.status` to `running`, set `startedAt = new Date()`, `currentStep = 'analysis'`.
    10. Enqueue BullMQ job `workflow:analysis` with `{ projectId, versionId, executionId, text: content.text, config: version.config }`.
    11. Return the execution record.

  - **`getWorkflowStatus(projectId, versionId, userId)`** — F-WF-04, F-WF-08:
    1. Call `ensureOwnership`.
    2. Load latest `WorkflowExecution` for the version (most recent by `startedAt` or `id`).
    3. Load all `WorkflowStep` records for the execution.
    4. Compute weighted progress (§9): analysis=15%, image_generation=40%, audio_generation=20%, assembly=25%. For each step, multiply `step.progress` (0-100) by its weight. Sum all. Return integer 0-100.
    5. Return `{ status, progress, currentStep, steps: [{ step, status, progress, details, startedAt, completedAt }] }`.

  - **`advanceWorkflow(executionId, completedStep, result)`**: called by NATS subscriber handlers:
    1. Update the completed `WorkflowStep` to status `completed`, `progress = 100`, `completedAt = now()`, `details = result`.
    2. Update `WorkflowExecution.progress` with recalculated weighted sum.
    3. Determine next step and enqueue the corresponding BullMQ job.
    4. Publish `visiobook.project.workflow.step_completed` NATS event.
    5. If no more steps, call `completeWorkflow()`.

  - **`failWorkflow(executionId, failedStep, error)`**: called on step failure:
    1. Update `WorkflowStep` to `failed` with error details.
    2. If BullMQ retries not exhausted, the job will auto-retry (handled by BullMQ).
    3. If BullMQ retries exhausted, update `WorkflowExecution.status` to `failed`, set `completedAt`, `error`.
    4. Transition XState to `failed`. Update `ProjectVersion.status` to `failed`.
    5. Publish `visiobook.project.workflow.failed` NATS event.

  - **`completeWorkflow(executionId, videoUrl)`**: called when assembly completes:
    1. Set `ProjectVersion.videoUrl = videoUrl`, `status = completed`.
    2. Update `WorkflowExecution.status = completed`, `completedAt = now()`, `progress = 100`.
    3. Decrement user quota via `userServiceClient.decrementQuota(userId)`.
    4. Publish `visiobook.project.workflow.completed` NATS event.

### 2.23 Workflow Progress Calculation Logic (F-WF-04, §9)

> **Deps**: 2.22

- [ ] Implement the weighted progress calculation as a pure utility function (testable in isolation):
  ```
  Step weights: analysis=15, image_generation=40, audio_generation=20, assembly=25
  Overall = Σ (step.progress × step.weight) / 100
  ```
  For `image_generation`, compute per-scene sub-progress: if 5 scenes and 3 complete, `step.progress = (3/5) × 100 = 60`. Overall contribution: `60 × 0.40 = 24%`.
  Handle `scene_extraction` and `character_extraction` as sub-phases of `analysis` (bundled into the 15% weight).
  Return clamped integer 0-100.

### 2.24 Workflow Controller (F-WF-01, F-WF-08, §8)

> **Deps**: 2.22

- [ ] Create `src/workflow/workflow.controller.ts` with route prefix `projects/:projectId/versions/:versionId/workflow`. Inject `WorkflowService`. Endpoints:
  - `POST /start` → `startWorkflow(@CurrentUser() userId, @Param('projectId') projectId, @Param('versionId') versionId)`: call `service.startWorkflow()`, return `202` Accepted with execution record.
  - `GET /status` → `getWorkflowStatus(@CurrentUser() userId, @Param('projectId') projectId, @Param('versionId') versionId)`: call `service.getWorkflowStatus()`, return `200` with status object.
  Validate route params as UUIDs.
- [ ] Create `src/workflow/dto/workflow-status-response.dto.ts`: Zod schema for the status response — `executionId`, `status`, `progress` (0-100), `currentStep`, `steps` (array of step objects with `step`, `status`, `progress`, `details`, `startedAt`, `completedAt`).

### 2.25 Workflow Module Registration

> **Deps**: 2.24

- [ ] Create `src/workflow/workflow.module.ts`: declare `WorkflowController`, provide `WorkflowService`, `WorkflowProcessor`. Import `PrismaModule`, `ProjectModule`, `ContentModule`, `VersionModule`, `MessagingModule`, `BullModule.registerQueue({ name: 'project-workflow' })`. Export `WorkflowService`.
- [ ] Import `WorkflowModule` in `src/app.module.ts`.
- [ ] Configure BullMQ root connection in `AppModule` if not already done: `BullModule.forRoot({ connection: { host: config.REDIS_HOST, port: config.REDIS_PORT, password: config.REDIS_PASSWORD, db: config.REDIS_DB } })`.

### 2.26 Wire NATS Subscriber Handlers to Workflow Service

> **Deps**: 2.22, 2.16

- [ ] Update `src/messaging/nats.subscriber.ts` — implement full handler logic:
  - **`handleAnalysisCompleted(data)`**: parse `{ projectId, versionId, executionId, summary, scenes[], characters[], metadata }`. In a Prisma transaction:
    1. Bulk-create `Scene` records from `scenes` array (map each to `{ projectId, order, text, description, imagePrompt, duration, sentiment }`).
    2. Bulk-create `Character` records from `characters` array (map each to `{ projectId, name, description, aliases, traits }`).
    3. Update `ProjectContent.summary = summary`.
    4. Update `WorkflowStep` records: set `analysis`, `scene_extraction`, `character_extraction` to `completed`.
    5. Transition version status to `analyzed`.
    6. Call `workflowService.advanceWorkflow()` or directly enqueue next job: if scenes exist, enqueue `workflow:image-generation` with scenes data. Transition to `generating`.
  - **`handleAnalysisFailed(data)`**: parse `{ executionId, error }`. Call `workflowService.failWorkflow(executionId, 'analysis', error)`.
  - **`handleImageCompleted(data)`**: parse `{ sceneId, sceneOrder, imageUrl }`. Update `Scene.generatedImageUrl = imageUrl`. Update `WorkflowStep` `image_generation` progress: increment by `(1 / totalScenes) × 100`. Publish `step_completed` if it's a sub-progress update. If ALL scenes now have `generatedImageUrl`, advance to `workflow:audio-generation`.
  - **`handleAudioCompleted(data)`**: parse `{ narrationUrl, musicUrl, totalDuration }`. Store audio URLs in `WorkflowExecution.details` or a suitable location. Update `WorkflowStep` `audio_generation` to `completed`. Enqueue `workflow:assembly`.
  - **`handleAssemblyCompleted(data)`**: parse `{ videoUrl, hlsUrl, duration, resolution }`. Call `workflowService.completeWorkflow(executionId, videoUrl)`.
  - **`handleAssemblyFailed(data)`**: parse `{ executionId, error }`. Call `workflowService.failWorkflow(executionId, 'assembly', error)`.
  - **`handleProgress(data)`**: parse `{ executionId, step, progress, message }`. Update `WorkflowStep.progress` for the indicated step. (Emit internal event for SSE — implemented in Phase 3.)

### 2.27 P1 Unit Tests

> **Deps**: 2.1 — 2.26

- [ ] Create `test/unit/project/project.service.spec.ts`: mock Prisma and NatsPublisher. Tests:
  - `create`: creates project + content in transaction, computes wordCount correctly, returns project with content.
  - `findById`: returns project for correct owner; throws `NotFoundException` for wrong owner; throws `NotFoundException` for non-existent id.
  - `findAllByUser`: returns paginated results filtered by userId and `deletedAt IS NULL`; respects sort order; handles empty results.
  - `update`: updates title/config; throws `ConflictException` when workflow is running (version status = analyzing/generating); throws 404 for non-owner.
  - `softDelete`: sets `deletedAt`; publishes NATS `project.deleted` event with storage keys; throws 404 for non-owner.
- [ ] Create `test/unit/content/content.service.spec.ts`: mock Prisma + ProjectService. Tests:
  - `getContent`: returns content; throws 404 when no content exists; calls `ensureOwnership`.
  - `updateContent`: updates text + recomputes wordCount; updates metadata; calls `ensureOwnership`.
  - `listScenes`: returns scenes ordered by `order ASC`; returns empty array when no scenes.
- [ ] Create `test/unit/version/version.service.spec.ts`: mock Prisma + ProjectService. Tests:
  - `create`: auto-increments versionNumber (first=1, second=2); snapshots project config when dto.config absent; uses dto.config when provided.
  - `listByProject`: returns versions ordered by `versionNumber DESC`.
  - `findById`: returns version with nested executions and steps; throws 404 when not found.
- [ ] Create `test/unit/workflow/workflow.machine.spec.ts`: test XState machine directly (no mocks needed):
  - All valid transitions produce correct next state.
  - `draft → analyzing` blocked when `hasContent = false` (guard fails).
  - `draft → analyzing` blocked when `hasQuota = false`.
  - `analyzed → generating` blocked when `hasScenes = false`.
  - `failed → analyzing` blocked when `retryCount >= maxRetries`.
  - Invalid transitions (e.g., `draft → completed`) do not change state.
- [ ] Create `test/unit/workflow/workflow.service.spec.ts`: mock all dependencies. Tests:
  - `startWorkflow`: verifies ownership, content, quota; creates execution + steps; enqueues job; publishes event; returns execution. Test failure paths: no content (400), no quota (403), version not in draft (409).
  - `getWorkflowStatus`: computes weighted progress correctly; returns step breakdown.
  - `advanceWorkflow`: updates step to completed; recalculates progress; enqueues next job; publishes step_completed.
  - `failWorkflow`: marks step failed; transitions to failed when retries exhausted; publishes failed event.
  - `completeWorkflow`: sets videoUrl; marks completed; decrements quota; publishes completed event.
- [ ] Create `test/unit/workflow/workflow.progress.spec.ts`: test weighted progress utility function:
  - All steps at 0% → overall 0%.
  - Analysis (100%) only → 15%.
  - Analysis (100%) + images (100%) → 55%.
  - All steps (100%) → 100%.
  - Partial image progress (3/5 scenes × 40% weight) → correct value.
  - Clamping: never exceeds 100.
- [ ] Create `test/unit/messaging/nats.publisher.spec.ts`: mock NATS JetStream client. Test each publish method: correct subject used, payload serialized as JSON, ack awaited, retry on failure, log on exhaustion.
- [ ] Create `test/unit/messaging/nats.subscriber.spec.ts`: mock message objects. Test each handler: correct parsing, ack on success, nak on error, routing by subject.
- [ ] Create `test/unit/clients/user-service.client.spec.ts`: mock `HttpService`. Tests:
  - `checkQuota`: returns parsed response; retries on 500; throws 503 after 3 retries.
  - `decrementQuota`: sends POST; retries on failure.
- [ ] Create `test/unit/clients/storage-service.client.spec.ts`: mock `HttpService`. Tests:
  - `getUploadUrl`: returns url+key; retries.
  - `deleteFile`: sends DELETE; retries.
  - `getFileMetadata`: returns metadata; retries.

### 2.28 P1 Integration Tests

> **Deps**: 2.27

- [ ] Create `test/integration/setup.ts`: testcontainers setup — start PostgreSQL 16, Redis 7, NATS 2.10 containers. Apply Prisma migrations to PostgreSQL. Export connection URLs and initialized Prisma client. Create `afterAll` teardown to stop containers.
- [ ] Create `test/integration/project/project.service.integration.spec.ts`: test against real PostgreSQL:
  - CRUD operations persist and retrieve correctly.
  - `userId` index is used (verify via `EXPLAIN ANALYZE` or query performance).
  - Soft-delete: `deletedAt` set, subsequent findById returns 404, findAll excludes deleted.
  - Unique constraints: duplicate project+versionNumber rejected.
  - Cascade delete: deleting project cascades to content, scenes, characters, versions, share links.
- [ ] Create `test/integration/workflow/workflow.processor.integration.spec.ts`: test against real Redis:
  - Enqueue `workflow:analysis` job and verify it is picked up by processor.
  - Job retry on failure: simulate failure, verify job retried up to max retries.
  - Job timeout: simulate stuck job, verify stalled detection after 30s.
  - Exponential backoff: verify delay between retries increases.
- [ ] Create `test/integration/messaging/nats.integration.spec.ts`: test against real NATS:
  - Publish event → subscriber receives it.
  - JetStream ack: acknowledged messages are not redelivered.
  - JetStream nack: negatively acknowledged messages are redelivered.
  - Durable consumer: after reconnect, missed messages are delivered.
  - Max deliver: after 5 failed deliveries, message stops being redelivered.

---

## Phase 3 — P2 Extended MVP

> Enhanced features: full-text search, content details, workflow management, sharing, notifications, observability, and comprehensive testing. (§6 P2)

### 3.1 Full-Text Search — F-PM-06 (§5, §8)

> **Deps**: 2.4

- [ ] Create a Prisma migration adding PostgreSQL full-text search support:
  - Add a `tsvector` generated column on `Project` (from `title`): `ALTER TABLE "Project" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", ''))) STORED;`
  - Add a `tsvector` generated column on `ProjectContent` (from `text`): `ALTER TABLE "ProjectContent" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("text", ''))) STORED;`
  - Create GIN indexes: `CREATE INDEX idx_project_search ON "Project" USING GIN ("searchVector");` and `CREATE INDEX idx_content_search ON "ProjectContent" USING GIN ("searchVector");`
- [ ] Add `search(userId: string, query: string, pagination)` method to `ProjectService`:
  - Use Prisma `$queryRaw` to execute full-text search: `SELECT ... FROM "Project" p LEFT JOIN "ProjectContent" pc ON p.id = pc."projectId" WHERE p."userId" = $1 AND p."deletedAt" IS NULL AND (p."searchVector" @@ plainto_tsquery('english', $2) OR pc."searchVector" @@ plainto_tsquery('english', $2)) ORDER BY ts_rank(p."searchVector", plainto_tsquery('english', $2)) + ts_rank(pc."searchVector", plainto_tsquery('english', $2)) DESC`.
  - Apply pagination (LIMIT/OFFSET). Return `PaginatedResponse`.
- [ ] Add `GET /search` endpoint to `ProjectController`: accept `q` (string, min 1, required) and pagination query params. Guard with `FEATURE_SEARCH_ENABLED` config flag. Return `200` with results or `200` with empty array.

### 3.2 Content Summary — F-CM-03 (§5, §8)

> **Deps**: 2.9

- [ ] Add `getSummary(projectId: string, userId: string)` method to `ContentService`: verify ownership, query `ProjectContent.summary`. Return `{ summary }`. If summary is null (analysis not yet run), return `{ summary: null }` or throw `404`.
- [ ] Add `GET /summary` endpoint to `ContentController`: return `200`.

### 3.3 Update Individual Scene — F-CM-05 (§5, §8)

> **Deps**: 2.9

- [ ] Create `src/content/dto/update-scene.dto.ts`: Zod schema — `text` (string, optional), `description` (string, optional), `imagePrompt` (string, optional). At least one field required.
- [ ] Add `updateScene(projectId: string, sceneId: string, userId: string, dto)` method to `ContentService`: verify ownership, find `Scene` where `id = sceneId AND projectId = projectId`, throw 404 if not found, update provided fields, return updated scene.
- [ ] Add `PATCH /scenes/:sceneId` endpoint to `ContentController`: accept `UpdateSceneDto`, validate UUID params, return `200`.

### 3.4 List Extracted Characters — F-CM-06 (§5, §8)

> **Deps**: 2.9

- [ ] Create `src/content/dto/character-response.dto.ts`: Zod schema — `id`, `projectId`, `name`, `description`, `aliases` (string array), `traits` (string array).
- [ ] Add `listCharacters(projectId: string, userId: string)` method to `ContentService`: verify ownership, return all `Character` records for the project.
- [ ] Add `GET /characters` endpoint to `ContentController`: return `200` with character array.

### 3.5 Cancel Running Workflow — F-WF-05 (§5, §8, §9)

> **Deps**: 2.25

- [ ] Add `cancelWorkflow(projectId, versionId, userId)` method to `WorkflowService`:
  1. Verify ownership.
  2. Load latest `WorkflowExecution` for the version. Verify status is `running`.
  3. Load current `ProjectVersion.status` — must be `analyzing` or `generating` to be cancellable. Throw `ConflictException` if not cancellable.
  4. Remove all pending BullMQ jobs for this execution from the `project-workflow` queue.
  5. Update all `pending` and `running` WorkflowSteps to `skipped`.
  6. Update `WorkflowExecution.status = cancelled`, `completedAt = now()`.
  7. Update `ProjectVersion.status = cancelled`.
  8. Publish `visiobook.project.workflow.cancelled` NATS event with `{ projectId, versionId, executionId, cancelledStep: currentStep, timestamp, correlationId }`.
- [ ] Add `POST /cancel` endpoint to `WorkflowController`: call `service.cancelWorkflow()`, return `200`.

### 3.6 Retry Failed Workflow — F-WF-06 (§5, §8, §9)

> **Deps**: 2.25

- [ ] Add `retryWorkflow(projectId, versionId, userId)` method to `WorkflowService`:
  1. Verify ownership.
  2. Load `ProjectVersion`, verify status is `failed`. Throw `ConflictException` otherwise.
  3. Count existing `WorkflowExecution` records for this version. If count >= `maxRetries` (from config or guard), throw `BadRequestException` ("Maximum retries exceeded").
  4. Create new `WorkflowExecution` record (status `pending`).
  5. Create new `WorkflowStep` records. Mark previously completed steps as `skipped` in the new execution (their results are reused). Create `pending` steps for the failed step and subsequent ones.
  6. Transition XState: send `RETRY` event (failed → analyzing).
  7. Update `ProjectVersion.status = analyzing`.
  8. Enqueue BullMQ job from the failed step (not from the beginning).
  9. Return new execution.
- [ ] Add `POST /retry` endpoint to `WorkflowController`: call `service.retryWorkflow()`, return `202`.

### 3.7 SSE Real-Time Progress Stream — F-WF-07 (§5, §8)

> **Deps**: 2.25

- [ ] Create `src/workflow/workflow.sse.controller.ts` with route prefix `projects/:projectId/versions/:versionId/workflow`. Endpoint:
  - `GET /progress/stream` — use NestJS `@Sse()` decorator returning `Observable<MessageEvent>`. On connection:
    1. Verify ownership (`@CurrentUser()` userId, projectId).
    2. Emit initial state (current progress snapshot).
    3. Subscribe to an internal EventEmitter/RxJS Subject for progress updates matching this `versionId`.
    4. On each update, emit SSE event: `{ data: { progress, currentStep, stepDetails, status } }`.
    5. On workflow terminal state (`completed`, `failed`, `cancelled`), emit final event and complete the Observable (close stream).
    6. Guard with `FEATURE_SSE_ENABLED` config flag — return 404 or 501 if disabled.
- [ ] Update `WorkflowService` to emit events via an injectable `EventEmitter2` (or RxJS Subject) whenever:
  - Progress updates (from NATS `ai.progress` handler).
  - Step completes.
  - Workflow completes/fails/is cancelled.
- [ ] Register `WorkflowSSEController` in `WorkflowModule`.
- [ ] Add `active_sse_connections` metric: increment on connection, decrement on disconnect.

### 3.8 Create Share Link — F-SH-01 (§5, §8)

> **Deps**: 2.4

- [ ] Create `src/share/dto/create-share-link.dto.ts`: Zod schema — `expiresAt` (string, ISO 8601 datetime, optional — if provided, must be in the future), `allowDownload` (boolean, optional, default `false`).
- [ ] Create `src/share/dto/share-link-response.dto.ts`: Zod schema — `id`, `projectId`, `shareToken`, `expiresAt`, `allowDownload`, `createdAt`. Exclude `passwordHash`.
- [ ] Create `src/share/share.service.ts` with `PrismaService` and `ProjectService`. Method:
  - `createShareLink(projectId, userId, dto)`: verify ownership. Generate 32-byte cryptographically random token using `crypto.randomBytes(32).toString('base64url')` (URL-safe). Create `ShareLink` record. Return response without `passwordHash`.

### 3.9 Public Access via Share Link — F-SH-05 (§5, §8, §17)

> **Deps**: 3.8

- [ ] Add `accessSharedProject(token: string)` method to `ShareService`:
  1. Find `ShareLink` by `shareToken`. Throw 404 if not found.
  2. Check expiration: if `expiresAt` is set and is in the past, throw 404 (expired).
  3. If `passwordHash` is not null, return `{ requiresPassword: true }` (client must call verify endpoint).
  4. Load the project's latest `completed` version (highest `versionNumber` with `status = completed`). If none, throw 404.
  5. Return `{ title: project.title, videoUrl: version.videoUrl, allowDownload: shareLink.allowDownload, createdAt: project.createdAt }`. Do NOT expose `userId`, `projectId`, or internal metadata.
- [ ] Create `src/share/dto/shared-project-response.dto.ts`: Zod schema — `title`, `videoUrl`, `allowDownload`, `requiresPassword` (boolean), `createdAt`.
- [ ] Create `src/share/share.controller.ts` with two route groups:
  - **Authenticated** (`projects/:projectId/share`): `POST /` → create share link (from 3.8).
  - **Public** (`shared`): `GET /:token` → `accessSharedProject()`, decorated with `@Public()`. Return `200`.
- [ ] Guard share creation behind `FEATURE_SHARE_ENABLED` config flag.

### 3.10 Share Module Registration

> **Deps**: 3.8, 3.9

- [ ] Create `src/share/share.module.ts`: declare `ShareController`, provide `ShareService`, import `PrismaModule` and `ProjectModule`. Export `ShareService`.
- [ ] Import `ShareModule` in `src/app.module.ts`.

### 3.11 HTTP Client: core-notification-service — F-IS-05 (§11)

> **Deps**: 1.1

- [ ] Create `src/clients/notification-service.client.ts` using `HttpService`. Inject `NOTIFICATION_SERVICE_URL`. Method:
  - `sendNotification(params: { userId: string; type: 'generation_completed' | 'generation_failed'; data: Record<string, unknown> }): Promise<void>`:
    `POST {NOTIFICATION_SERVICE_URL}/api/v1/notifications/send` with body `{ userId, type, data }`.
    Retry 3 times, exponential backoff (1s, 2s, 4s). Timeout 5s.
    **On failure after retries: log warning but do NOT throw** (notifications are best-effort per §11).
    Include `X-Request-Id` header.
- [ ] Integrate into `WorkflowService`:
  - On `completeWorkflow()`: call `notificationServiceClient.sendNotification({ userId, type: 'generation_completed', data: { projectId, versionId, videoUrl } })`.
  - On `failWorkflow()` (retries exhausted): call `sendNotification({ userId, type: 'generation_failed', data: { projectId, versionId, error } })`.

### 3.12 AI Pipeline Callback Handling Hardening — F-IS-06 (§11)

> **Deps**: 2.26

- [ ] Review and harden all NATS subscriber handlers:
  - Validate every required field in incoming payloads using Zod schemas. Nak (not ack) messages with invalid payloads.
  - Handle idempotency: if a scene's `generatedImageUrl` is already set and we receive another `image.completed` for the same scene, skip update and ack.
  - Handle race conditions: use Prisma transactions where multiple records are updated.
  - Log each processed message at `info` level with `{ subject, executionId, correlationId }`.
- [ ] Implement dead-letter handling: when a message exceeds `maxDeliver` (5 attempts), NATS stops redelivering. Log the poison message at `error` level with full payload for manual inspection. Consider publishing to a `visiobook.deadletter.>` subject for monitoring.

### 3.13 Prometheus Metrics Endpoint — F-IF-02 (§15)

> **Deps**: Phase 1 complete

- [ ] Create a metrics service/module using `prom-client`. Initialize default metrics (`collectDefaultMetrics()`). Define custom metrics matching §15:
  - `http_requests_total` — Counter, labels: `method`, `path`, `status`.
  - `http_request_duration_seconds` — Histogram, labels: `method`, `path`. Buckets: `[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`.
  - `workflow_executions_total` — Counter, labels: `status` (completed/failed/cancelled).
  - `workflow_duration_seconds` — Histogram.
  - `workflow_step_duration_seconds` — Histogram, labels: `step`.
  - `bullmq_jobs_active` — Gauge, labels: `queue`.
  - `bullmq_jobs_waiting` — Gauge, labels: `queue`.
  - `bullmq_jobs_failed_total` — Counter, labels: `queue`.
  - `nats_messages_published_total` — Counter, labels: `subject`.
  - `nats_messages_received_total` — Counter, labels: `subject`.
  - `prisma_query_duration_seconds` — Histogram, labels: `operation`.
  - `active_sse_connections` — Gauge.
- [ ] Create `GET /metrics` endpoint (decorated with `@Public()`) returning `register.metrics()` in Prometheus exposition format (`text/plain; version=0.0.4`).
- [ ] Create a NestJS interceptor (`MetricsInterceptor`) that, on every HTTP request, increments `http_requests_total` and observes `http_request_duration_seconds`. Register globally.
- [ ] Instrument `NatsPublisher`: increment `nats_messages_published_total` on each publish.
- [ ] Instrument `NatsSubscriber`: increment `nats_messages_received_total` on each received message.
- [ ] Instrument `WorkflowService`: observe `workflow_duration_seconds` on completion, increment `workflow_executions_total`. Observe `workflow_step_duration_seconds` per step.
- [ ] Instrument BullMQ: periodically (e.g., every 10s via `setInterval`) query queue `getJobCounts()` and update `bullmq_jobs_active` and `bullmq_jobs_waiting` gauges.
- [ ] Instrument Prisma: use Prisma middleware or `$use` to observe `prisma_query_duration_seconds` per operation type.

### 3.14 OpenAPI/Swagger Documentation — F-IF-04 (§2, §8)

> **Deps**: Phase 1, feature modules registered

- [ ] Verify Swagger is configured in `main.ts` (from 1.7): `SwaggerModule.createDocument(app, config)` and `SwaggerModule.setup('api/docs', app, document)`. Config: `DocumentBuilder().setTitle('core-project-service').setVersion('1.0').setDescription('VisioBook core project service API').addApiKey({ type: 'apiKey', name: 'X-User-Id', in: 'header' }, 'gateway-auth').build()`.
- [ ] Add `@ApiTags('Projects')` to `ProjectController`.
- [ ] Add `@ApiTags('Content')` to `ContentController`.
- [ ] Add `@ApiTags('Versions')` to `VersionController`.
- [ ] Add `@ApiTags('Workflow')` to `WorkflowController` and `WorkflowSSEController`.
- [ ] Add `@ApiTags('Sharing')` to `ShareController`.
- [ ] Add `@ApiTags('Health')` to `HealthController`.
- [ ] Verify all endpoints appear in `/api/docs` with correct request bodies, query parameters, path parameters, and response schemas (auto-generated from nestjs-zod DTOs).
- [ ] Guard Swagger behind `SWAGGER_ENABLED` config flag (disabled in production per §13).

### 3.15 Request Correlation ID Propagation — F-IF-05 (§15)

> **Deps**: 1.3

- [ ] Verify `LoggingInterceptor` extracts `X-Request-Id` from incoming requests and generates a UUID if absent. Store as `correlationId` accessible to all downstream code (via `AsyncLocalStorage`, `cls-hooked`, or NestJS request scope).
- [ ] Update `UserServiceClient`: include `{ 'X-Request-Id': correlationId }` header in every outbound HTTP request.
- [ ] Update `StorageServiceClient`: include `X-Request-Id` header.
- [ ] Update `NotificationServiceClient`: include `X-Request-Id` header.
- [ ] Update `NatsPublisher`: include `correlationId` field in every published NATS event payload (already defined in §10 event schemas — verify it's actually populated).
- [ ] Verify Pino logs include `correlationId` on every log line across all services and modules.

### 3.16 Graceful Shutdown — F-IF-06 (§5)

> **Deps**: 2.25

- [ ] Ensure `app.enableShutdownHooks()` is called in `main.ts` (from 1.7).
- [ ] Implement `onModuleDestroy()` in `MessagingModule` (or `NatsPublisher`/`NatsSubscriber`): drain NATS subscriptions, close NATS connection.
- [ ] Implement `onModuleDestroy()` in `WorkflowProcessor` (or `WorkflowModule`): close BullMQ workers (wait for active jobs via `worker.close()`), close queue connections.
- [ ] Implement `onModuleDestroy()` in `PrismaService`: call `$disconnect()`.
- [ ] Implement `onModuleDestroy()` for Redis connections (if separate from BullMQ): close ioredis clients used for health checks or caching.
- [ ] Test shutdown sequence: on `SIGTERM`, verify the following order — (1) stop accepting HTTP requests, (2) drain BullMQ workers, (3) drain NATS, (4) disconnect Prisma, (5) close Redis, (6) exit process. Verify no resource leaks or hanging connections.

### 3.17 Environment-Specific Helm Values — F-CD-04 (§13)

> **Deps**: 1.11

- [ ] Create `helm/values-dev.yaml` overriding base values:
  - `replicaCount: 1`
  - `hpa: { minReplicas: 1, maxReplicas: 2 }`
  - `resources: { requests: { cpu: 100m, memory: 128Mi }, limits: { cpu: 500m, memory: 256Mi } }`
  - `env: { LOG_LEVEL: debug, SWAGGER_ENABLED: "true" }`
- [ ] Create `helm/values-staging.yaml`:
  - `replicaCount: 2`
  - `hpa: { minReplicas: 2, maxReplicas: 5 }`
  - `resources: { requests: { cpu: 250m, memory: 256Mi }, limits: { cpu: 1000m, memory: 512Mi } }`
  - `env: { LOG_LEVEL: info, SWAGGER_ENABLED: "true" }`
- [ ] Create `helm/values-prod.yaml`:
  - `replicaCount: 3`
  - `hpa: { minReplicas: 3, maxReplicas: 10 }`
  - `resources: { requests: { cpu: 500m, memory: 512Mi }, limits: { cpu: 2000m, memory: 1024Mi } }`
  - `env: { LOG_LEVEL: info, SWAGGER_ENABLED: "false" }`

### 3.18 E2E Tests with Testcontainers — F-CD-05 (§14)

> **Deps**: 2.28

- [ ] Create `test/e2e/setup.ts`: bootstrap the full NestJS application with testcontainers for PostgreSQL, Redis, and NATS. Apply Prisma migrations. Return `app` instance and `supertest` agent. Tear down containers in `afterAll`.
- [ ] Create test utility helpers:
  - `test/helpers/seed.ts`: factory functions `createTestProject(overrides?)`, `createTestContent(projectId, overrides?)`, `createTestScene(projectId, overrides?)`, `createTestVersion(projectId, overrides?)`, `createTestExecution(versionId, overrides?)`. Each creates a record via Prisma and returns it.
  - `test/helpers/auth.ts`: `authenticatedRequest(agent, userId?)` returns a supertest wrapper that sets `X-User-Id` header. `unauthenticatedRequest(agent)` omits the header.
  - `test/helpers/nats.ts`: `publishMockEvent(subject, payload)` publishes a mock NATS event and waits for processing (with configurable timeout).
  - `test/helpers/bullmq.ts`: `waitForJobCompletion(queue, jobId, timeout?)` waits for a BullMQ job to complete.
- [ ] Create `test/e2e/project.e2e.spec.ts`:
  - Create project → 201 with correct body.
  - Get project → 200 with matching data.
  - List projects → 200 with pagination metadata.
  - Update project → 200 with updated fields.
  - Delete project → 204, subsequent GET → 404.
  - No `X-User-Id` header → 401.
  - User A creates project, User B GETs it → 404 (ownership enforcement).
  - Invalid body (missing title) → 400 with field errors.
  - Invalid UUID in path → 400.
- [ ] Create `test/e2e/content.e2e.spec.ts`:
  - Get content → 200.
  - Update content (change text) → 200, verify `wordCount` recalculated.
  - List scenes → 200, ordered by `order`.
  - No scenes → 200 with empty array.
- [ ] Create `test/e2e/version.e2e.spec.ts`:
  - Create version → 201, `versionNumber` = 1.
  - Create second version → 201, `versionNumber` = 2.
  - List versions → 200, descending order.
  - Get version with executions → 200 with nested data.
- [ ] Create `test/e2e/workflow.e2e.spec.ts`:
  - Start workflow → 202 with execution record.
  - Poll status → 200 with progress.
  - Simulate analysis complete by publishing `visiobook.ai.analysis.completed` NATS event → verify scenes/characters created, version status updated.
  - Full end-to-end workflow: start → analysis complete → images complete (per scene) → audio complete → assembly complete → verify version has videoUrl, status = completed.
  - Start workflow with no content → 400.
  - Start workflow with no quota → 403.
- [ ] Create `test/e2e/share.e2e.spec.ts`:
  - Create share link → 201 with token.
  - Access shared project via token → 200 with video data.
  - Access expired token → 404.
  - Access invalid token → 404.
  - Access password-protected link without password → 200 with `requiresPassword: true`.

### 3.19 P2 Unit Tests

> **Deps**: 3.1 — 3.16

- [ ] Create `test/unit/project/project-search.spec.ts`: mock Prisma `$queryRaw`. Tests: matching query returns results; non-matching returns empty; pagination applied; feature flag disabled returns 404/501.
- [ ] Create `test/unit/content/content-summary.spec.ts`: test getSummary — returns summary when exists; returns null when analysis not run.
- [ ] Create `test/unit/content/scene-update.spec.ts`: test updateScene — partial updates (only text, only imagePrompt, etc.); 404 for non-existent scene; ownership verified.
- [ ] Create `test/unit/content/characters.spec.ts`: test listCharacters — returns characters; empty array when none.
- [ ] Create `test/unit/workflow/workflow-cancel.spec.ts`: test cancel — transitions state; removes BullMQ jobs; publishes event; 409 when not in cancellable state (draft, completed).
- [ ] Create `test/unit/workflow/workflow-retry.spec.ts`: test retry — creates new execution; skips completed steps; enqueues from failed step; 409 when not failed; max retries exceeded error.
- [ ] Create `test/unit/workflow/workflow-sse.spec.ts`: test SSE controller — emits initial state; emits updates; closes on terminal state; feature flag check.
- [ ] Create `test/unit/share/share.service.spec.ts`: test create (generates 32+ byte URL-safe token, stores record); access (valid token returns data, expired throws 404, password-protected returns requiresPassword flag).
- [ ] Create `test/unit/clients/notification-service.client.spec.ts`: test sendNotification — sends POST; retries on failure; does NOT throw on exhaustion (logs warning instead).
- [ ] Create `test/unit/common/metrics.spec.ts`: test metrics interceptor increments counters; metrics endpoint returns valid Prometheus format.

---

## Phase 4 — P3 Polish

> Advanced features, optimization, and edge cases. (§6 P3)

### 4.1 Password-Protected Share Links — F-SH-02 (§5, §17)

> **Deps**: 3.8

- [ ] Update `src/share/dto/create-share-link.dto.ts`: add optional `password` field (string, min 8 characters if provided).
- [ ] Update `ShareService.createShareLink()`: if `dto.password` is provided, hash it with `bcrypt` using work factor `12`. Store the hash in `ShareLink.passwordHash`. Return response without password or hash.

### 4.2 Password Verification — F-SH-06 (§5, §8, §17)

> **Deps**: 4.1

- [ ] Create `src/share/dto/verify-password.dto.ts`: Zod schema — `password` (string, required).
- [ ] Add `verifySharePassword(token: string, password: string)` method to `ShareService`:
  1. Find `ShareLink` by `shareToken`. Throw 404 if not found.
  2. Check expiration. Throw 404 if expired.
  3. Verify `passwordHash` is not null (link is actually password-protected). Throw 400 if not.
  4. Compare `password` with `passwordHash` using `bcrypt.compare()`.
  5. On match: load project's latest completed version. Return shared project data.
  6. On mismatch: throw `UnauthorizedException` (401).
- [ ] Add `POST /shared/:token/verify` endpoint to `ShareController` (public route, `@Public()`): accept `VerifyPasswordDto`, return `200` with shared project data or `401`.

### 4.3 Get Share Link Info — F-SH-03 (§5, §8)

> **Deps**: 3.8

- [ ] Add `getShareLinkInfo(projectId: string, userId: string)` method to `ShareService`: verify ownership. Query `ShareLink` by `projectId`. If none exists, throw 404. Return `{ id, projectId, shareToken, expiresAt, allowDownload, isPasswordProtected: !!passwordHash, createdAt }` (exclude actual hash).
- [ ] Add `GET /` endpoint to `ShareController` (authenticated, `projects/:projectId/share`): return `200` with share link info.

### 4.4 Delete Share Link — F-SH-04 (§5, §8)

> **Deps**: 3.8

- [ ] Add `deleteShareLink(projectId: string, userId: string)` method to `ShareService`: verify ownership. Delete `ShareLink` record where `projectId` matches. Throw 404 if no link exists. Hard-delete (not soft-delete). Return void.
- [ ] Add `DELETE /` endpoint to `ShareController` (authenticated, `projects/:projectId/share`): return `204`.

### 4.5 Compare Versions — F-VM-04 (§5, §8)

> **Deps**: 2.13

- [ ] Add `compareVersions(projectId: string, v1Id: string, v2Id: string, userId: string)` method to `VersionService`:
  1. Verify ownership.
  2. Load both `ProjectVersion` records. Throw 404 if either not found.
  3. Compute config diff: iterate keys in both `config` JSON objects. Categorize into `added` (in v2 but not v1), `removed` (in v1 but not v2), `changed` (in both but different values). Return `{ v1: { versionNumber, config }, v2: { versionNumber, config }, diff: { added, removed, changed } }`.
- [ ] Create `src/version/dto/version-compare-response.dto.ts`: Zod schema for the comparison result.
- [ ] Add `GET /:v1/compare/:v2` endpoint to `VersionController`: validate both params as UUIDs, return `200`.

### 4.6 Revert to Previous Version — F-VM-05 (§5, §8)

> **Deps**: 2.13

- [ ] Add `revertToVersion(projectId: string, versionId: string, userId: string)` method to `VersionService`:
  1. Verify ownership.
  2. Load `ProjectVersion`. Throw 404 if not found.
  3. Copy `version.config` to `Project.config` (overwrite current config with the version's snapshot).
  4. Update `Project.updatedAt`.
  5. Return updated project.
- [ ] Add `POST /:versionId/revert` endpoint to `VersionController`: return `200` with updated project.

### 4.7 Redis Caching Layer — F-IF-08 (§5)

> **Deps**: Phase 1

- [ ] Create a `CacheService` using `ioredis` (inject Redis connection from config). Methods:
  - `get<T>(key: string): Promise<T | null>`: get and JSON.parse.
  - `set(key: string, value: unknown, ttlSeconds: number): Promise<void>`: JSON.stringify and set with EX.
  - `del(key: string): Promise<void>`: delete key.
  - `delByPattern(pattern: string): Promise<void>`: scan and delete keys matching pattern (for bulk invalidation).
- [ ] Add caching to `ProjectService.findById()`: cache key `project:{id}`, TTL 300s (5 min). Check cache before DB query. Set cache after DB query. Invalidate on `update()` and `softDelete()`.
- [ ] Add caching to `ContentService.getContent()`: cache key `content:{projectId}`, TTL 300s. Invalidate on `updateContent()`.
- [ ] Add caching to `ContentService.getSummary()`: cache key `summary:{projectId}`, TTL 600s (10 min). Invalidate when analysis re-runs (new scenes/summary stored).

### 4.8 Input Sanitization — F-SV-03 (§17)

> **Deps**: 1.5

- [ ] Install sanitization library: `sanitize-html` (or `xss`) and `@types/sanitize-html` (dev).
- [ ] Create `src/common/utils/sanitize.ts`: export `sanitizeText(input: string): string` that:
  - Strips all HTML tags.
  - Removes `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>` elements and their contents.
  - Strips event handler attributes (`onclick`, `onerror`, `onload`, etc.).
  - Preserves plain text content.
- [ ] Apply sanitization to user-provided text fields at the service layer (before DB write):
  - `ProjectService.create()`: sanitize `dto.content.text` and `dto.title`.
  - `ProjectService.update()`: sanitize `dto.title` if provided.
  - `ContentService.updateContent()`: sanitize `dto.text` if provided.
  - `ContentService.updateScene()`: sanitize `dto.text`, `dto.description`, `dto.imagePrompt` if provided.

### 4.9 Rate Limiting Headers Forwarding — F-SV-04 (§17)

> **Deps**: Phase 1

- [ ] Create `src/common/interceptors/rate-limit-headers.interceptor.ts`: NestJS interceptor that reads `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` from the incoming request headers (set by Kong gateway upstream) and copies them to the outgoing response headers.
- [ ] Register as a global interceptor in `main.ts`.

### 4.10 Advanced Project Status Tracking — F-PM-07 (§5)

> **Deps**: 2.4, 2.13

- [ ] Update `ProjectService` to automatically derive and update project status:
  - On `VersionService.create()` (first version for a project): if project status is `draft`, update to `active`.
  - Provide an explicit archive mechanism: add `archiveProject(projectId, userId)` method to `ProjectService` that sets status to `archived`.
  - Optionally add `PATCH /:id/archive` endpoint or accept `status: "archived"` in the existing `UpdateProjectDto`.
- [ ] Ensure `findAllByUser` and `search` queries can filter by project status (add optional `status` query param to list endpoint).

### 4.11 P3 Unit Tests

> **Deps**: 4.1 — 4.10

- [ ] Create `test/unit/share/share-password.spec.ts`: test password-protected share creation (bcrypt hash stored with work factor 12); verification (correct password returns data, incorrect returns 401, expired link returns 404).
- [ ] Create `test/unit/share/share-crud.spec.ts`: test getShareLinkInfo (returns metadata, `isPasswordProtected` boolean); deleteShareLink (hard-deletes, 404 when none exists).
- [ ] Create `test/unit/version/version-compare.spec.ts`: test compareVersions — identical configs (no diff); added keys; removed keys; changed values; nested object changes.
- [ ] Create `test/unit/version/version-revert.spec.ts`: test revertToVersion — project config updated to match version config; project `updatedAt` changed; 404 for non-existent version.
- [ ] Create `test/unit/common/redis-cache.spec.ts`: mock `ioredis`. Test get (returns cached value, returns null on miss), set (stores with TTL), del (removes key), delByPattern (removes matching keys). Test cache integration: findById returns cached value on second call.
- [ ] Create `test/unit/common/sanitize.spec.ts`: test sanitizeText — strips `<script>` tags (including content), strips `<iframe>`, strips event handlers (`onclick`), preserves normal text, handles nested tags, handles empty/null input.
- [ ] Create `test/unit/common/rate-limit-headers.spec.ts`: test interceptor — forwards all three rate limit headers from request to response; handles missing headers gracefully (no error, just not set on response).
- [ ] Create `test/unit/project/project-status.spec.ts`: test advanced status tracking — new project is `draft`; becomes `active` on first version creation; can be archived; `findAllByUser` respects status filter.

---

## Summary

| Phase | Description | Sections | Approx. Tasks |
|-------|-------------|----------|---------------|
| **Phase 0** | Project Scaffolding | 5 | ~20 |
| **Phase 1** | P0 Foundational Infrastructure | 12 | ~55 |
| **Phase 2** | P1 Core MVP | 15 | ~85 |
| **Phase 3** | P2 Extended MVP | 19 | ~70 |
| **Phase 4** | P3 Polish | 11 | ~35 |
| **Total** | | **62 sections** | **~265 tasks** |

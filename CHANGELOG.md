# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

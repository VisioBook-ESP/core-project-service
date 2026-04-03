/**
 * Shared setup utilities for integration tests (Wave 11, Task 2.28a).
 *
 * Each test file manages its own containers for isolation.
 * These helpers start testcontainers and provide a PrismaClient
 * wired through the same @prisma/adapter-pg driver adapter used in production.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

export interface PostgresContext {
  container: StartedPostgreSqlContainer;
  connectionUrl: string;
}

export async function startPostgres(): Promise<PostgresContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionUrl = container.getConnectionUri();

  // Apply migration SQL directly (bypasses prisma.config.ts which does not
  // expose datasource.url, making `prisma migrate deploy` fail).
  const migrations = [
    '20260306085746_init',
    '20260402120000_make_source_type_optional',
    '20260402130000_remove_source_type',
  ];
  const pool = new pg.Pool({ connectionString: connectionUrl });
  try {
    for (const migration of migrations) {
      const sql = readFileSync(
        join(process.cwd(), 'prisma', 'migrations', migration, 'migration.sql'),
        'utf-8',
      );
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }

  return { container, connectionUrl };
}

// ---------------------------------------------------------------------------
// PrismaClient (uses the same adapter-pg driver adapter as production)
// ---------------------------------------------------------------------------

export interface TestPrismaContext {
  prisma: PrismaClient;
  pool: pg.Pool;
}

export function createTestPrismaClient(databaseUrl: string): TestPrismaContext {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

export async function disconnectTestPrisma(ctx: TestPrismaContext): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.pool.end();
}

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

export interface RedisContext {
  container: StartedTestContainer;
  host: string;
  port: number;
}

export async function startRedis(): Promise<RedisContext> {
  const container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  return {
    container,
    host: container.getHost(),
    port: container.getMappedPort(6379),
  };
}

// ---------------------------------------------------------------------------
// NATS (with JetStream enabled)
// ---------------------------------------------------------------------------

export interface NatsContext {
  container: StartedTestContainer;
  url: string;
}

export async function startNats(): Promise<NatsContext> {
  const container = await new GenericContainer('nats:2.10-alpine')
    .withCommand(['-js']) // Enable JetStream
    .withExposedPorts(4222)
    .withWaitStrategy(Wait.forLogMessage('Server is ready'))
    .start();

  return {
    container,
    url: `nats://${container.getHost()}:${container.getMappedPort(4222)}`,
  };
}

// ---------------------------------------------------------------------------
// Database cleanup (respects FK constraints via CASCADE)
// ---------------------------------------------------------------------------

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "WorkflowStep" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "WorkflowExecution" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ShareLink" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE IF EXISTS "Location" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Character" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Scene" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProjectVersion" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ProjectContent" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Project" CASCADE');
}

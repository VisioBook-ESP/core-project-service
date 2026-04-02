/**
 * Integration tests for Prisma queries against a real PostgreSQL (Wave 11, Task 2.28b).
 *
 * Uses testcontainers to spin up an ephemeral PostgreSQL instance,
 * runs Prisma migrations, and exercises real database operations.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  startPostgres,
  createTestPrismaClient,
  disconnectTestPrisma,
  cleanDatabase,
  type PostgresContext,
  type TestPrismaContext,
} from '../setup.js';

let pgCtx: PostgresContext;
let dbCtx: TestPrismaContext;

beforeAll(async () => {
  pgCtx = await startPostgres();
  dbCtx = createTestPrismaClient(pgCtx.connectionUrl);
  await dbCtx.prisma.$connect();
}, 60_000);

beforeEach(async () => {
  await cleanDatabase(dbCtx.prisma);
});

afterAll(async () => {
  if (dbCtx) {
    await disconnectTestPrisma(dbCtx);
  }
  if (pgCtx) {
    await pgCtx.container.stop();
  }
});

describe('Project Prisma queries (integration)', () => {
  it('should create a project and retrieve it with correct fields', async () => {
    const created = await dbCtx.prisma.project.create({
      data: {
        userId: 'user-1',
        title: 'My Project',
        config: { style: 'cartoon' },
      },
    });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe('user-1');
    expect(created.title).toBe('My Project');
    expect(created.status).toBe('draft');
    expect(created.deletedAt).toBeNull();

    const found = await dbCtx.prisma.project.findFirst({
      where: { id: created.id, userId: 'user-1', deletedAt: null },
    });
    expect(found).not.toBeNull();
    expect(found!.title).toBe('My Project');
    expect(found!.config).toEqual({ style: 'cartoon' });
  });

  it('should create a project with nested content and compute wordCount', async () => {
    const project = await dbCtx.prisma.project.create({
      data: {
        userId: 'user-1',
        title: 'Content Project',
        config: {},
        content: {
          create: {
            text: 'Hello world test content here',
            wordCount: 5,
            metadata: {},
          },
        },
      },
      include: { content: true },
    });

    expect(project.content).not.toBeNull();
    expect(project.content!.text).toBe('Hello world test content here');
    expect(project.content!.wordCount).toBe(5);
    expect(project.content!.projectId).toBe(project.id);
  });

  it('should enforce userId isolation (ownership pattern)', async () => {
    await dbCtx.prisma.project.create({
      data: {
        userId: 'user-A',
        title: 'Secret Project',
        config: {},
      },
    });

    // User B should not see User A's project
    const result = await dbCtx.prisma.project.findFirst({
      where: { userId: 'user-B', deletedAt: null },
    });
    expect(result).toBeNull();
  });

  it('should hide soft-deleted projects from standard queries', async () => {
    const project = await dbCtx.prisma.project.create({
      data: {
        userId: 'user-1',
        title: 'Will be deleted',
        config: {},
      },
    });

    // Soft-delete
    await dbCtx.prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date() },
    });

    // Standard query with deletedAt:null should not find it
    const found = await dbCtx.prisma.project.findFirst({
      where: { id: project.id, userId: 'user-1', deletedAt: null },
    });
    expect(found).toBeNull();

    // But it still exists in the database (soft-deleted)
    const stillExists = await dbCtx.prisma.project.findFirst({
      where: { id: project.id },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists!.deletedAt).not.toBeNull();
  });

  it('should support pagination with skip/take', async () => {
    // Create 5 projects
    for (let i = 1; i <= 5; i++) {
      await dbCtx.prisma.project.create({
        data: {
          userId: 'user-1',
          title: `Project ${i}`,
          config: {},
        },
      });
    }

    const page = await dbCtx.prisma.project.findMany({
      where: { userId: 'user-1', deletedAt: null },
      skip: 2,
      take: 2,
      orderBy: { title: 'asc' },
    });

    expect(page).toHaveLength(2);

    const total = await dbCtx.prisma.project.count({
      where: { userId: 'user-1', deletedAt: null },
    });
    expect(total).toBe(5);
  });

  it('should enforce ProjectVersion unique constraint on (projectId, versionNumber)', async () => {
    const project = await dbCtx.prisma.project.create({
      data: {
        userId: 'user-1',
        title: 'Version Test',
        config: {},
      },
    });

    await dbCtx.prisma.projectVersion.create({
      data: {
        projectId: project.id,
        versionNumber: 1,
        config: {},
      },
    });

    // Attempting to create a second version with the same versionNumber should fail
    await expect(
      dbCtx.prisma.projectVersion.create({
        data: {
          projectId: project.id,
          versionNumber: 1,
          config: {},
        },
      }),
    ).rejects.toThrow();
  });
});

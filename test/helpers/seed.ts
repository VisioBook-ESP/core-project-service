/**
 * Database seeding helpers for E2E tests.
 */

import { randomUUID } from 'node:crypto';
import { TEST_USER_ID } from './auth.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

// ---------- Project ----------

export interface SeedProjectOverrides {
  id?: string;
  userId?: string;
  title?: string;
  sourceType?: 'file' | 'scan' | 'text';
  status?: 'draft' | 'active' | 'archived';
  config?: Record<string, unknown>;
  deletedAt?: Date | null;
}

export async function seedProject(prisma: PrismaClient, overrides: SeedProjectOverrides = {}) {
  return prisma.project.create({
    data: {
      id: overrides.id ?? randomUUID(),
      userId: overrides.userId ?? TEST_USER_ID,
      title: overrides.title ?? 'Test Project',
      ...(overrides.sourceType ? { sourceType: overrides.sourceType } : {}),
      status: overrides.status ?? 'draft',
      config: overrides.config ?? {},
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

// ---------- Project + Content ----------

export interface SeedProjectWithContentOverrides extends SeedProjectOverrides {
  text?: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function seedProjectWithContent(
  prisma: PrismaClient,
  overrides: SeedProjectWithContentOverrides = {},
) {
  const project = await seedProject(prisma, overrides);
  const text = overrides.text ?? 'This is some test content for the project.';
  const content = await prisma.projectContent.create({
    data: {
      projectId: project.id,
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      summary: overrides.summary ?? null,
      metadata: overrides.metadata ?? {},
    },
  });
  return { project, content };
}

// ---------- Version ----------

export interface SeedVersionOverrides {
  id?: string;
  versionNumber?: number;
  status?:
    | 'draft'
    | 'analyzing'
    | 'analyzed'
    | 'configuring'
    | 'generating'
    | 'completed'
    | 'failed'
    | 'cancelled';
  config?: Record<string, unknown>;
  videoUrl?: string | null;
}

export async function seedVersion(
  prisma: PrismaClient,
  projectId: string,
  overrides: SeedVersionOverrides = {},
) {
  const versionNumber =
    overrides.versionNumber ??
    ((
      await prisma.projectVersion.aggregate({
        where: { projectId },
        _max: { versionNumber: true },
      })
    )._max.versionNumber ?? 0) + 1;

  return prisma.projectVersion.create({
    data: {
      id: overrides.id ?? randomUUID(),
      projectId,
      versionNumber,
      status: overrides.status ?? 'draft',
      config: overrides.config ?? {},
      videoUrl: overrides.videoUrl ?? null,
    },
  });
}

// ---------- Execution ----------

export interface SeedExecutionOverrides {
  id?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string | null;
  progress?: number;
  error?: Record<string, unknown> | null;
}

const PIPELINE_STEPS = [
  'analysis',
  'scene_extraction',
  'character_extraction',
  'image_generation',
  'audio_generation',
  'assembly',
] as const;

export async function seedExecution(
  prisma: PrismaClient,
  projectId: string,
  versionId: string,
  overrides: SeedExecutionOverrides = {},
) {
  const execution = await prisma.workflowExecution.create({
    data: {
      id: overrides.id ?? randomUUID(),
      projectId,
      versionId,
      status: overrides.status ?? 'running',
      currentStep: overrides.currentStep ?? 'analysis',
      progress: overrides.progress ?? 0,
      startedAt: new Date(),
      error: overrides.error ?? undefined,
      steps: {
        create: PIPELINE_STEPS.map((step) => ({
          step,
          status: 'pending' as const,
          progress: 0,
        })),
      },
    },
    include: { steps: true },
  });
  return execution;
}

// ---------- Share Link ----------

export interface SeedShareLinkOverrides {
  id?: string;
  shareToken?: string;
  passwordHash?: string | null;
  expiresAt?: Date | null;
  allowDownload?: boolean;
}

export async function seedShareLink(
  prisma: PrismaClient,
  projectId: string,
  overrides: SeedShareLinkOverrides = {},
) {
  return prisma.shareLink.create({
    data: {
      id: overrides.id ?? randomUUID(),
      projectId,
      shareToken: overrides.shareToken ?? randomUUID(),
      passwordHash: overrides.passwordHash ?? null,
      expiresAt: overrides.expiresAt ?? null,
      allowDownload: overrides.allowDownload ?? false,
    },
  });
}

// ---------- Scenes ----------

export async function seedScenes(prisma: PrismaClient, projectId: string, count: number = 2) {
  const scenes = [];
  for (let i = 0; i < count; i++) {
    scenes.push(
      await prisma.scene.create({
        data: {
          projectId,
          order: i + 1,
          text: `Scene ${i + 1} text`,
          description: `Scene ${i + 1} description`,
          imagePrompt: `Scene ${i + 1} prompt`,
          duration: 5.0,
          sentiment: 'neutral',
        },
      }),
    );
  }
  return scenes;
}

// ---------- Characters ----------

export async function seedCharacters(prisma: PrismaClient, projectId: string, count: number = 2) {
  const characters = [];
  for (let i = 0; i < count; i++) {
    characters.push(
      await prisma.character.create({
        data: {
          projectId,
          name: `Character ${i + 1}`,
          description: `Description of character ${i + 1}`,
          aliases: [`Alias ${i + 1}`],
          traits: [`Trait ${i + 1}`],
        },
      }),
    );
  }
  return characters;
}

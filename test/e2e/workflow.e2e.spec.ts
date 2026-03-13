import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bootstrapE2E, cleanDatabase, type E2EContext } from './setup.js';
import { authHeaders, TEST_USER_ID, OTHER_USER_ID } from '../helpers/auth.js';
import {
  seedProjectWithContent,
  seedVersion,
  seedExecution,
  seedProject,
} from '../helpers/seed.js';

describe('WorkflowController (E2E)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  }, 120_000);

  afterAll(async () => {
    await ctx.cleanup();
  }, 30_000);

  beforeEach(async () => {
    await cleanDatabase(ctx.prisma);
    ctx.mocks.userServiceClient.checkQuota.mockResolvedValue({
      hasQuota: true,
      remaining: 10,
    });
  });

  // ---- Start ----

  it('POST .../workflow/start — starts workflow and returns 201', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id);

    const res = await request(ctx.httpServer)
      .post(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/start`,
      )
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('running');
    expect(res.body.steps).toBeDefined();
    expect(res.body.steps.length).toBe(6);
  });

  // ---- Status ----

  it('GET .../workflow/status/:executionId — returns execution status', async () => {
    const project = await seedProject(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id, {
      status: 'analyzing',
    });
    const execution = await seedExecution(
      ctx.prisma,
      project.id,
      version.id,
      { status: 'running', currentStep: 'analysis' },
    );

    const res = await request(ctx.httpServer)
      .get(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/status/${execution.id}`,
      )
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(execution.id);
    expect(res.body.status).toBe('running');
    expect(res.body.steps).toHaveLength(6);
  });

  // ---- Cancel ----

  it('POST .../workflow/cancel/:executionId — cancels running workflow', async () => {
    const project = await seedProject(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id, {
      status: 'analyzing',
    });
    const execution = await seedExecution(
      ctx.prisma,
      project.id,
      version.id,
      { status: 'running', currentStep: 'analysis' },
    );

    const res = await request(ctx.httpServer)
      .post(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/cancel/${execution.id}`,
      )
      .set(authHeaders());

    expect(res.status).toBe(200);
  });

  it('POST .../workflow/cancel/:executionId — returns 409 for non-running', async () => {
    const project = await seedProject(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id, {
      status: 'completed',
    });
    const execution = await seedExecution(
      ctx.prisma,
      project.id,
      version.id,
      { status: 'completed', currentStep: null },
    );

    const res = await request(ctx.httpServer)
      .post(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/cancel/${execution.id}`,
      )
      .set(authHeaders());

    expect(res.status).toBe(409);
  });

  // ---- Retry ----

  it('POST .../workflow/retry/:executionId — retries failed workflow', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id, {
      status: 'failed',
    });
    await seedExecution(ctx.prisma, project.id, version.id, {
      status: 'failed',
      currentStep: 'analysis',
      error: { step: 'analysis', message: 'Test error' },
    });

    const res = await request(ctx.httpServer)
      .post(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/retry/ignored-param`,
      )
      .set(authHeaders());

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('running');
  });

  // ---- Ownership ----

  it('GET .../workflow/status/:executionId — returns 404 for other user', async () => {
    const project = await seedProject(ctx.prisma, { userId: OTHER_USER_ID });
    const version = await seedVersion(ctx.prisma, project.id);
    const execution = await seedExecution(
      ctx.prisma,
      project.id,
      version.id,
      { status: 'running' },
    );

    const res = await request(ctx.httpServer)
      .get(
        `/api/v1/projects/${project.id}/versions/${version.id}/workflow/status/${execution.id}`,
      )
      .set(authHeaders(TEST_USER_ID));

    expect(res.status).toBe(404);
  });
});

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bootstrapE2E, cleanDatabase, type E2EContext } from './setup.js';
import { authHeaders, TEST_USER_ID, OTHER_USER_ID } from '../helpers/auth.js';
import { seedProject, seedVersion } from '../helpers/seed.js';

describe('VersionController (E2E)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await bootstrapE2E();
  }, 120_000);

  afterAll(async () => {
    await ctx.cleanup();
  }, 30_000);

  beforeEach(async () => {
    await cleanDatabase(ctx.prisma);
  });

  // ---- Create ----

  it('POST /projects/:id/versions — creates version with versionNumber=1', async () => {
    const project = await seedProject(ctx.prisma);

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/versions`)
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.versionNumber).toBe(1);
    expect(res.body.status).toBe('draft');
  });

  it('POST /projects/:id/versions — auto-increments version number', async () => {
    const project = await seedProject(ctx.prisma);
    await seedVersion(ctx.prisma, project.id, { versionNumber: 1 });

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/versions`)
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.versionNumber).toBe(2);
  });

  // ---- List ----

  it('GET /projects/:id/versions — returns versions list', async () => {
    const project = await seedProject(ctx.prisma);
    await seedVersion(ctx.prisma, project.id, { versionNumber: 1 });
    await seedVersion(ctx.prisma, project.id, { versionNumber: 2 });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/versions`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  // ---- Get single ----

  it('GET /projects/:id/versions/:versionId — returns version with executions', async () => {
    const project = await seedProject(ctx.prisma);
    const version = await seedVersion(ctx.prisma, project.id);

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/versions/${version.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(version.id);
    expect(res.body).toHaveProperty('executions');
  });

  // ---- Ownership ----

  it('GET /projects/:id/versions — returns 404 for other user project', async () => {
    const project = await seedProject(ctx.prisma, { userId: OTHER_USER_ID });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/versions`)
      .set(authHeaders(TEST_USER_ID));

    expect(res.status).toBe(404);
  });

  it('POST /projects/:id/versions — returns 404 for other user project', async () => {
    const project = await seedProject(ctx.prisma, { userId: OTHER_USER_ID });

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/versions`)
      .set(authHeaders(TEST_USER_ID))
      .send({});

    expect(res.status).toBe(404);
  });
});

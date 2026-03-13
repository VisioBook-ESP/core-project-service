import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bootstrapE2E, cleanDatabase, type E2EContext } from './setup.js';
import { authHeaders, TEST_USER_ID, OTHER_USER_ID } from '../helpers/auth.js';
import { seedProject, seedShareLink } from '../helpers/seed.js';

describe('ShareController (E2E)', () => {
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

  // ---- Create share link ----

  it('POST /projects/:id/share — creates a share link', async () => {
    const project = await seedProject(ctx.prisma);

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/share`)
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('shareToken');
    expect(res.body.projectId).toBe(project.id);
  });

  it('POST /projects/:id/share — creates share link with expiry', async () => {
    const project = await seedProject(ctx.prisma);
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/share`)
      .set(authHeaders())
      .send({ expiresAt: futureDate, allowDownload: true });

    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeDefined();
    expect(res.body.allowDownload).toBe(true);
  });

  // ---- Access shared project ----

  it('GET /shared/:token — returns project without auth', async () => {
    const project = await seedProject(ctx.prisma, { title: 'Shared Project' });
    const shareLink = await seedShareLink(ctx.prisma, project.id);

    const res = await request(ctx.httpServer)
      .get(`/api/v1/shared/${shareLink.shareToken}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Shared Project');
    expect(res.body.requiresPassword).toBe(false);
  });

  it('GET /shared/:token — returns 404 for expired link', async () => {
    const project = await seedProject(ctx.prisma);
    const shareLink = await seedShareLink(ctx.prisma, project.id, {
      expiresAt: new Date(Date.now() - 86_400_000), // expired yesterday
    });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/shared/${shareLink.shareToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /shared/:token — returns 404 for invalid token', async () => {
    const res = await request(ctx.httpServer)
      .get('/api/v1/shared/nonexistent-token');

    expect(res.status).toBe(404);
  });

  // ---- Ownership ----

  it('POST /projects/:id/share — returns 404 for other user project', async () => {
    const project = await seedProject(ctx.prisma, { userId: OTHER_USER_ID });

    const res = await request(ctx.httpServer)
      .post(`/api/v1/projects/${project.id}/share`)
      .set(authHeaders(TEST_USER_ID))
      .send({});

    expect(res.status).toBe(404);
  });
});

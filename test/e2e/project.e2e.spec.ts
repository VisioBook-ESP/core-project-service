import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bootstrapE2E, cleanDatabase, type E2EContext } from './setup.js';
import { authHeaders, TEST_USER_ID, OTHER_USER_ID } from '../helpers/auth.js';
import { seedProject, seedProjectWithContent } from '../helpers/seed.js';

describe('ProjectController (E2E)', () => {
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

  // ---- Auth ----

  it('returns 401 when X-User-Id header is missing', async () => {
    const res = await request(ctx.httpServer).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-User-Id is not a valid UUID', async () => {
    const res = await request(ctx.httpServer)
      .get('/api/v1/projects')
      .set('X-User-Id', 'not-a-uuid');
    expect(res.status).toBe(401);
  });

  // ---- Create ----

  it('POST /projects — creates a project and returns 201', async () => {
    const res = await request(ctx.httpServer)
      .post('/api/v1/projects')
      .set(authHeaders())
      .send({
        title: 'My New Project',
        sourceType: 'text',
        content: { text: 'Hello world content' },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My New Project');
    expect(res.body.sourceType).toBe('text');
    expect(res.body.userId).toBe(TEST_USER_ID);
  });

  it('POST /projects — returns 400 on missing title', async () => {
    const res = await request(ctx.httpServer)
      .post('/api/v1/projects')
      .set(authHeaders())
      .send({
        sourceType: 'text',
        content: { text: 'Hello world' },
      });

    expect(res.status).toBe(400);
  });

  // ---- List ----

  it('GET /projects — lists projects for current user', async () => {
    await seedProject(ctx.prisma, { userId: TEST_USER_ID, title: 'Proj A' });
    await seedProject(ctx.prisma, { userId: TEST_USER_ID, title: 'Proj B' });
    await seedProject(ctx.prisma, { userId: OTHER_USER_ID, title: 'Other' });

    const res = await request(ctx.httpServer)
      .get('/api/v1/projects')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /projects — supports pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await seedProject(ctx.prisma, { title: `Project ${i}` });
    }

    const res = await request(ctx.httpServer)
      .get('/api/v1/projects?page=1&pageSize=2')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
  });

  // ---- Get single ----

  it('GET /projects/:id — returns the project', async () => {
    const project = await seedProject(ctx.prisma, { title: 'Get Me' });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(project.id);
    expect(res.body.title).toBe('Get Me');
  });

  it('GET /projects/:id — returns 404 for another user project', async () => {
    const project = await seedProject(ctx.prisma, { userId: OTHER_USER_ID });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}`)
      .set(authHeaders(TEST_USER_ID));

    expect(res.status).toBe(404);
  });

  // ---- Update ----

  it('PATCH /projects/:id — updates the project title', async () => {
    const project = await seedProject(ctx.prisma, { title: 'Old Title' });

    const res = await request(ctx.httpServer)
      .patch(`/api/v1/projects/${project.id}`)
      .set(authHeaders())
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  // ---- Delete ----

  it('DELETE /projects/:id — soft-deletes then GET returns 404', async () => {
    const project = await seedProject(ctx.prisma);

    const delRes = await request(ctx.httpServer)
      .delete(`/api/v1/projects/${project.id}`)
      .set(authHeaders());

    expect(delRes.status).toBe(204);

    const getRes = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}`)
      .set(authHeaders());

    expect(getRes.status).toBe(404);
  });

  // ---- Search ----

  it('GET /projects/search — returns matching projects', async () => {
    await seedProjectWithContent(ctx.prisma, {
      title: 'Quantum computing research',
      text: 'Advanced quantum entanglement studies',
    });
    await seedProjectWithContent(ctx.prisma, {
      title: 'Baking recipes',
      text: 'Chocolate cake recipe',
    });

    // Fulltext search needs a small delay for generated columns
    const res = await request(ctx.httpServer)
      .get('/api/v1/projects/search?q=quantum')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].title).toContain('Quantum');
  });

  it('GET /projects/search — returns empty for nonexistent term', async () => {
    await seedProject(ctx.prisma, { title: 'Normal project' });

    const res = await request(ctx.httpServer)
      .get('/api/v1/projects/search?q=xyznonexistent')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

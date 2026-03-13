import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bootstrapE2E, cleanDatabase, type E2EContext } from './setup.js';
import { authHeaders, TEST_USER_ID, OTHER_USER_ID } from '../helpers/auth.js';
import { seedProjectWithContent, seedScenes, seedCharacters } from '../helpers/seed.js';

describe('ContentController (E2E)', () => {
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

  // ---- Get content ----

  it('GET /projects/:id/content — returns content', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma, {
      text: 'Hello world content',
    });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Hello world content');
    expect(res.body.wordCount).toBe(3);
  });

  it('GET /projects/:id/content — returns 404 for other user', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma, {
      userId: OTHER_USER_ID,
    });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content`)
      .set(authHeaders(TEST_USER_ID));

    expect(res.status).toBe(404);
  });

  // ---- Update content ----

  it('PATCH /projects/:id/content — updates text and wordCount', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);

    const res = await request(ctx.httpServer)
      .patch(`/api/v1/projects/${project.id}/content`)
      .set(authHeaders())
      .send({ text: 'Updated text with more words now' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Updated text with more words now');
    expect(res.body.wordCount).toBe(6);
  });

  // ---- Scenes ----

  it('GET /projects/:id/content/scenes — returns scene list', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);
    await seedScenes(ctx.prisma, project.id, 3);

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content/scenes`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].order).toBe(1);
  });

  it('PATCH /projects/:id/content/scenes/:sceneId — updates a scene', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);
    const scenes = await seedScenes(ctx.prisma, project.id, 1);
    const sceneId = scenes[0]!.id;

    const res = await request(ctx.httpServer)
      .patch(`/api/v1/projects/${project.id}/content/scenes/${sceneId}`)
      .set(authHeaders())
      .send({ description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated description');
  });

  // ---- Summary ----

  it('GET /projects/:id/content/summary — returns summary', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma, {
      summary: 'A brief summary',
    });

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content/summary`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('A brief summary');
  });

  // ---- Characters ----

  it('GET /projects/:id/content/characters — returns character list', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);
    await seedCharacters(ctx.prisma, project.id, 2);

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content/characters`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /projects/:id/content/characters — returns empty array when none', async () => {
    const { project } = await seedProjectWithContent(ctx.prisma);

    const res = await request(ctx.httpServer)
      .get(`/api/v1/projects/${project.id}/content/characters`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

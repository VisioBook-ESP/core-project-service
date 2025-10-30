// import { Test, TestingModule } from '@nestjs/testing';
// import { INestApplication } from '@nestjs/common';
// //import * as request from 'supertest';
// import request from 'supertest';
// import { AppModule } from './../src/app.module';

// describe('AppController (e2e)', () => {
//   let app: INestApplication;

//   beforeEach(async () => {
//     const moduleFixture: TestingModule = await Test.createTestingModule({
//       imports: [AppModule],
//     }).compile();

//     app = moduleFixture.createNestApplication();
//     await app.init();
//   });

//   afterAll(async () => {
//     await app.close();
//   });

//   it('/ (GET)', async () => {
//     const response = await request(app.getHttpServer()).get('/').expect(200);

//     expect(response.text).toBe('Hello World!');
//   });

//   it('/health (GET)', async () => {
//     await request(app.getHttpServer()).get('/health').expect(200);
//   });
// });


// test/app.e2e-spec.ts
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('core-project-service');
  });

  it('/ready (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/ready')
      .expect(200);

    expect(res.body.ready).toBe(true);
  });

  it('/metrics (GET)', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(200);
  });
});

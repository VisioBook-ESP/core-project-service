/**
 * Integration tests for BullMQ against a real Redis (Wave 11, Task 2.28c).
 *
 * Uses testcontainers to spin up an ephemeral Redis instance
 * and exercises queue/worker interactions with real job processing.
 *
 * Each test creates and closes its own worker to avoid cross-test interference.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { startRedis, type RedisContext } from '../setup.js';
import { WORKFLOW_QUEUE_NAME } from '../../../src/workflow/workflow.types.js';

let redisCtx: RedisContext;

function redisConnection(): { host: string; port: number } {
  return { host: redisCtx.host, port: redisCtx.port };
}

beforeAll(async () => {
  redisCtx = await startRedis();
}, 60_000);

afterAll(async () => {
  await redisCtx.container.stop();
});

describe('BullMQ workflow queue (integration)', () => {
  it('should add a job and have a worker process it', async () => {
    const queueName = `${WORKFLOW_QUEUE_NAME}-test-1`;
    const queue = new Queue(queueName, { connection: redisConnection() });
    const worker = new Worker(
      queueName,
      async (job: Job) => job.data,
      { connection: redisConnection() },
    );

    try {
      const jobData = {
        projectId: 'p-1',
        versionId: 'v-1',
        executionId: 'e-1',
        step: 'analysis',
        correlationId: 'corr-1',
        userId: 'u-1',
      };

      const completed = new Promise<Job>((resolve) => {
        worker.on('completed', (job: Job) => resolve(job));
      });

      await queue.add('workflow:analysis', jobData);
      const job = await completed;

      expect(job.data).toEqual(jobData);
      expect(job.name).toBe('workflow:analysis');
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it('should preserve job data fields correctly', async () => {
    const queueName = `${WORKFLOW_QUEUE_NAME}-test-2`;
    const queue = new Queue(queueName, { connection: redisConnection() });
    const worker = new Worker(
      queueName,
      async (job: Job) => job.data,
      { connection: redisConnection() },
    );

    try {
      const jobData = {
        projectId: 'p-2',
        versionId: 'v-2',
        executionId: 'e-2',
        step: 'image_generation',
        correlationId: 'corr-2',
        userId: 'u-2',
        extra: { nested: true },
      };

      const completed = new Promise<Job>((resolve) => {
        worker.on('completed', (job: Job) => resolve(job));
      });

      await queue.add('workflow:image-generation', jobData);
      const job = await completed;

      expect(job.data.projectId).toBe('p-2');
      expect(job.data.step).toBe('image_generation');
      expect(job.data.extra).toEqual({ nested: true });
      expect(job.name).toBe('workflow:image-generation');
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it('should report failed jobs when worker throws', async () => {
    const queueName = `${WORKFLOW_QUEUE_NAME}-test-3`;
    const queue = new Queue(queueName, { connection: redisConnection() });
    const worker = new Worker(
      queueName,
      async () => {
        throw new Error('Simulated processing failure');
      },
      { connection: redisConnection() },
    );

    try {
      const failedPromise = new Promise<{ jobId: string; reason: string }>((resolve) => {
        worker.on('failed', (job: Job | undefined, err: Error) => {
          resolve({ jobId: job?.id ?? '', reason: err.message });
        });
      });

      const addedJob = await queue.add(
        'workflow:failing-job',
        { projectId: 'p-fail' },
        { attempts: 1 },
      );

      const result = await failedPromise;
      expect(result.jobId).toBe(addedJob.id);
      expect(result.reason).toBe('Simulated processing failure');
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it('should move completed jobs to the completed set', async () => {
    const queueName = `${WORKFLOW_QUEUE_NAME}-test-4`;
    const queue = new Queue(queueName, { connection: redisConnection() });
    const worker = new Worker(
      queueName,
      async () => ({ done: true }),
      {
        connection: redisConnection(),
        removeOnComplete: { count: 100 },
      },
    );

    try {
      const completedPromise = new Promise<void>((resolve) => {
        worker.on('completed', () => resolve());
      });

      await queue.add('workflow:completion-test', { projectId: 'p-complete' });
      await completedPromise;

      // Give BullMQ a moment to update internal state
      await new Promise((r) => setTimeout(r, 200));

      const completed = await queue.getCompleted();
      const match = completed.find((j) => j.data.projectId === 'p-complete');
      expect(match).toBeDefined();
      expect(match!.returnvalue).toEqual({ done: true });
    } finally {
      await worker.close();
      await queue.close();
    }
  });
});

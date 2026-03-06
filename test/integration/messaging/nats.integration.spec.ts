/**
 * Integration tests for NATS JetStream against a real NATS server (Wave 11, Task 2.28d).
 *
 * Uses testcontainers to spin up an ephemeral NATS instance with JetStream enabled
 * and exercises pub/sub, ack/nak, durable consumers, and stream configuration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connect,
  StringCodec,
  AckPolicy,
  RetentionPolicy,
  StorageType,
  type NatsConnection,
  type JetStreamManager,
} from 'nats';
import { startNats, type NatsContext } from '../setup.js';
import { STREAM_NAME, STREAM_SUBJECTS } from '../../../src/messaging/subjects.js';

let natsCtx: NatsContext;
let nc: NatsConnection;
let jsm: JetStreamManager;
const sc = StringCodec();

// Use a unique stream name per test run to avoid collisions
const testStream = `${STREAM_NAME}_TEST`;

beforeAll(async () => {
  natsCtx = await startNats();
  nc = await connect({ servers: natsCtx.url });
  jsm = await nc.jetstreamManager();

  // Create the test stream with the same subjects as production
  await jsm.streams.add({
    name: testStream,
    subjects: STREAM_SUBJECTS,
    retention: RetentionPolicy.Limits,
    storage: StorageType.Memory,
    max_msgs: 10_000,
  });
}, 60_000);

afterAll(async () => {
  if (jsm) {
    try {
      await jsm.streams.delete(testStream);
    } catch {
      // Stream may already be deleted or not exist
    }
  }
  if (nc) {
    await nc.drain();
  }
  await natsCtx.container.stop();
});

describe('NATS JetStream (integration)', () => {
  it('should publish a message and receive it via a consumer', async () => {
    const js = nc.jetstream();

    const payload = { projectId: 'p-1', event: 'started' };
    await js.publish(
      'visiobook.project.workflow.started',
      sc.encode(JSON.stringify(payload)),
    );

    // Create a durable consumer
    await jsm.consumers.add(testStream, {
      durable_name: 'test-basic-consumer',
      ack_policy: AckPolicy.Explicit,
      filter_subject: 'visiobook.project.>',
    });

    const consumer = await js.consumers.get(testStream, 'test-basic-consumer');
    const msg = await consumer.next({ expires: 5_000 });

    expect(msg).toBeDefined();
    const decoded = JSON.parse(sc.decode(msg!.data));
    expect(decoded.projectId).toBe('p-1');
    expect(decoded.event).toBe('started');
    msg!.ack();
  });

  it('should not redeliver a message after ack', async () => {
    const js = nc.jetstream();

    await js.publish(
      'visiobook.project.workflow.completed',
      sc.encode(JSON.stringify({ acked: true })),
    );

    await jsm.consumers.add(testStream, {
      durable_name: 'test-ack-consumer',
      ack_policy: AckPolicy.Explicit,
      filter_subject: 'visiobook.project.workflow.completed',
    });

    const consumer = await js.consumers.get(testStream, 'test-ack-consumer');

    // Receive and ack the message
    const msg = await consumer.next({ expires: 5_000 });
    expect(msg).toBeDefined();
    msg!.ack();

    // Trying to fetch again should time out (no redelivery)
    const second = await consumer.next({ expires: 1_000 });
    expect(second).toBeNull();
  });

  it('should redeliver a message after nak', async () => {
    const js = nc.jetstream();

    await js.publish(
      'visiobook.project.workflow.failed',
      sc.encode(JSON.stringify({ nacked: true })),
    );

    await jsm.consumers.add(testStream, {
      durable_name: 'test-nak-consumer',
      ack_policy: AckPolicy.Explicit,
      filter_subject: 'visiobook.project.workflow.failed',
    });

    const consumer = await js.consumers.get(testStream, 'test-nak-consumer');

    // Receive and nak the message
    const msg = await consumer.next({ expires: 5_000 });
    expect(msg).toBeDefined();
    msg!.nak();

    // The message should be redelivered
    const redelivered = await consumer.next({ expires: 5_000 });
    expect(redelivered).toBeDefined();

    const decoded = JSON.parse(sc.decode(redelivered!.data));
    expect(decoded.nacked).toBe(true);
    expect(redelivered!.info.redelivered).toBe(true);
    redelivered!.ack(); // Clean up
  });

  it('should persist a durable consumer across reconnections', async () => {
    const js = nc.jetstream();

    // Create durable consumer
    await jsm.consumers.add(testStream, {
      durable_name: 'test-durable-persist',
      ack_policy: AckPolicy.Explicit,
      filter_subject: 'visiobook.project.deleted',
    });

    // Publish a message
    await js.publish(
      'visiobook.project.deleted',
      sc.encode(JSON.stringify({ projectId: 'p-durable' })),
    );

    // Open a second connection (simulating reconnect)
    const nc2 = await connect({ servers: natsCtx.url });
    const js2 = nc2.jetstream();

    // The durable consumer should still exist and have the pending message
    const consumer = await js2.consumers.get(testStream, 'test-durable-persist');
    const msg = await consumer.next({ expires: 5_000 });

    expect(msg).toBeDefined();
    const decoded = JSON.parse(sc.decode(msg!.data));
    expect(decoded.projectId).toBe('p-durable');
    msg!.ack();

    await nc2.drain();
  });

  it('should create a stream with correct subjects and retention policy', async () => {
    // Query stream info
    const info = await jsm.streams.info(testStream);

    expect(info.config.name).toBe(testStream);
    expect(info.config.subjects).toEqual(expect.arrayContaining(STREAM_SUBJECTS));
    expect(info.config.retention).toBe(RetentionPolicy.Limits);
    expect(info.config.storage).toBe(StorageType.Memory);
  });
});

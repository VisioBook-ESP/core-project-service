import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  // HTTP metrics
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  // Workflow metrics
  readonly workflowExecutionsTotal: Counter;
  readonly workflowDuration: Histogram;
  readonly workflowStepDuration: Histogram;

  // BullMQ metrics
  readonly bullmqJobsActive: Gauge;
  readonly bullmqJobsWaiting: Gauge;
  readonly bullmqJobsFailedTotal: Counter;

  // NATS metrics
  readonly natsMessagesPublishedTotal: Counter;
  readonly natsMessagesReceivedTotal: Counter;

  // Database metrics
  readonly prismaQueryDuration: Histogram;

  // SSE metrics
  readonly activeSseConnections: Gauge;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.workflowExecutionsTotal = new Counter({
      name: 'workflow_executions_total',
      help: 'Total workflow executions by outcome',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.workflowDuration = new Histogram({
      name: 'workflow_duration_seconds',
      help: 'End-to-end workflow duration',
      buckets: [1, 5, 10, 30, 60, 120, 300, 600],
      registers: [this.registry],
    });

    this.workflowStepDuration = new Histogram({
      name: 'workflow_step_duration_seconds',
      help: 'Duration per pipeline step',
      labelNames: ['step'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.bullmqJobsActive = new Gauge({
      name: 'bullmq_jobs_active',
      help: 'Currently processing BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsWaiting = new Gauge({
      name: 'bullmq_jobs_waiting',
      help: 'BullMQ jobs waiting to be processed',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsFailedTotal = new Counter({
      name: 'bullmq_jobs_failed_total',
      help: 'Total failed BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.natsMessagesPublishedTotal = new Counter({
      name: 'nats_messages_published_total',
      help: 'Messages published to NATS',
      labelNames: ['subject'],
      registers: [this.registry],
    });

    this.natsMessagesReceivedTotal = new Counter({
      name: 'nats_messages_received_total',
      help: 'Messages received from NATS',
      labelNames: ['subject'],
      registers: [this.registry],
    });

    this.prismaQueryDuration = new Histogram({
      name: 'prisma_query_duration_seconds',
      help: 'Database query latency',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.activeSseConnections = new Gauge({
      name: 'active_sse_connections',
      help: 'Current open SSE connections',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }
}

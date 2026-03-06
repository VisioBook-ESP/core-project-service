import { createActor } from 'xstate';
import { workflowMachine } from '../../../src/workflow/workflow.machine.js';

function createTestActor(
  stateValue: string,
  contextOverrides: Partial<{
    hasContent: boolean;
    hasQuota: boolean;
    hasScenes: boolean;
    retryCount: number;
    maxRetries: number;
  }> = {},
) {
  const context = {
    projectId: 'p1',
    versionId: 'v1',
    executionId: 'e1',
    hasContent: false,
    hasQuota: true,
    hasScenes: false,
    retryCount: 0,
    maxRetries: 3,
    ...contextOverrides,
  };

  const snapshot = workflowMachine.resolveState({
    value: stateValue,
    context,
  });
  const actor = createActor(workflowMachine, { snapshot });
  actor.start();
  return actor;
}

describe('workflowMachine', () => {
  describe('draft state', () => {
    it('should transition to analyzing when hasContent is true', () => {
      const actor = createTestActor('draft', { hasContent: true });
      actor.send({ type: 'START_WORKFLOW' });
      expect(actor.getSnapshot().value).toBe('analyzing');
      actor.stop();
    });

    it('should remain in draft when hasContent is false', () => {
      const actor = createTestActor('draft', { hasContent: false });
      actor.send({ type: 'START_WORKFLOW' });
      expect(actor.getSnapshot().value).toBe('draft');
      actor.stop();
    });
  });

  describe('analyzing state', () => {
    it('should transition to analyzed on ANALYSIS_COMPLETE', () => {
      const actor = createTestActor('analyzing');
      actor.send({ type: 'ANALYSIS_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('analyzed');
      actor.stop();
    });

    it('should transition to failed on ANALYSIS_FAILED', () => {
      const actor = createTestActor('analyzing');
      actor.send({ type: 'ANALYSIS_FAILED' });
      expect(actor.getSnapshot().value).toBe('failed');
      actor.stop();
    });

    it('should transition to cancelled on CANCEL', () => {
      const actor = createTestActor('analyzing');
      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('cancelled');
      actor.stop();
    });
  });

  describe('analyzed state', () => {
    it('should transition to generating when hasScenes is true', () => {
      const actor = createTestActor('analyzed', { hasScenes: true });
      actor.send({ type: 'START_GENERATION' });
      expect(actor.getSnapshot().value).toBe('generating');
      actor.stop();
    });

    it('should remain in analyzed when hasScenes is false', () => {
      const actor = createTestActor('analyzed', { hasScenes: false });
      actor.send({ type: 'START_GENERATION' });
      expect(actor.getSnapshot().value).toBe('analyzed');
      actor.stop();
    });

    it('should transition to cancelled on CANCEL', () => {
      const actor = createTestActor('analyzed');
      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('cancelled');
      actor.stop();
    });
  });

  describe('generating state', () => {
    it('should transition to completed on GENERATION_COMPLETE', () => {
      const actor = createTestActor('generating');
      actor.send({ type: 'GENERATION_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('completed');
      actor.stop();
    });

    it('should transition to failed on GENERATION_FAILED', () => {
      const actor = createTestActor('generating');
      actor.send({ type: 'GENERATION_FAILED' });
      expect(actor.getSnapshot().value).toBe('failed');
      actor.stop();
    });

    it('should transition to cancelled on CANCEL', () => {
      const actor = createTestActor('generating');
      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('cancelled');
      actor.stop();
    });
  });

  describe('failed state', () => {
    it('should transition to analyzing on RETRY when canRetry is true', () => {
      const actor = createTestActor('failed', { retryCount: 0, maxRetries: 3 });
      actor.send({ type: 'RETRY' });
      expect(actor.getSnapshot().value).toBe('analyzing');
      actor.stop();
    });

    it('should remain in failed when retryCount >= maxRetries', () => {
      const actor = createTestActor('failed', { retryCount: 3, maxRetries: 3 });
      actor.send({ type: 'RETRY' });
      expect(actor.getSnapshot().value).toBe('failed');
      actor.stop();
    });

    it('should increment retryCount on successful RETRY', () => {
      const actor = createTestActor('failed', { retryCount: 1, maxRetries: 3 });
      actor.send({ type: 'RETRY' });
      expect(actor.getSnapshot().context.retryCount).toBe(2);
      actor.stop();
    });

    it('should transition to cancelled on CANCEL', () => {
      const actor = createTestActor('failed');
      actor.send({ type: 'CANCEL' });
      expect(actor.getSnapshot().value).toBe('cancelled');
      actor.stop();
    });
  });

  describe('final states', () => {
    it('completed should be a final state', () => {
      const actor = createTestActor('completed');
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe('done');
      actor.stop();
    });

    it('cancelled should be a final state', () => {
      const actor = createTestActor('cancelled');
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe('done');
      actor.stop();
    });
  });
});

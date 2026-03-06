import { setup, assign } from 'xstate';

export interface WorkflowContext {
  projectId: string;
  versionId: string;
  executionId: string;
  hasContent: boolean;
  hasQuota: boolean;
  hasScenes: boolean;
  retryCount: number;
  maxRetries: number;
}

export type WorkflowEvent =
  | { type: 'START_WORKFLOW' }
  | { type: 'ANALYSIS_COMPLETE' }
  | { type: 'ANALYSIS_FAILED' }
  | { type: 'START_GENERATION' }
  | { type: 'GENERATION_COMPLETE' }
  | { type: 'GENERATION_FAILED' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' };

export const workflowMachine = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
  guards: {
    hasContent: ({ context }) => context.hasContent,
    hasQuota: ({ context }) => context.hasQuota,
    hasScenes: ({ context }) => context.hasScenes,
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
  },
  actions: {
    incrementRetryCount: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
  },
}).createMachine({
  id: 'workflow',
  initial: 'draft',
  context: {
    projectId: '',
    versionId: '',
    executionId: '',
    hasContent: false,
    hasQuota: false,
    hasScenes: false,
    retryCount: 0,
    maxRetries: 3,
  },
  states: {
    draft: {
      on: {
        START_WORKFLOW: {
          target: 'analyzing',
          guard: 'hasContent',
        },
      },
    },
    analyzing: {
      on: {
        ANALYSIS_COMPLETE: 'analyzed',
        ANALYSIS_FAILED: 'failed',
        CANCEL: 'cancelled',
      },
    },
    analyzed: {
      on: {
        START_GENERATION: {
          target: 'generating',
          guard: {
            type: 'hasScenes',
          },
        },
        CANCEL: 'cancelled',
      },
    },
    generating: {
      on: {
        GENERATION_COMPLETE: 'completed',
        GENERATION_FAILED: 'failed',
        CANCEL: 'cancelled',
      },
    },
    completed: {
      type: 'final',
    },
    failed: {
      on: {
        RETRY: {
          target: 'analyzing',
          guard: 'canRetry',
          actions: ['incrementRetryCount'],
        },
        CANCEL: 'cancelled',
      },
    },
    cancelled: {
      type: 'final',
    },
  },
});

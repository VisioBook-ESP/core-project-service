// NATS JetStream subject constants and stream configuration

// --- Outbound subjects (published by this service) ---
export const SUBJECTS = {
  // Workflow lifecycle events
  WORKFLOW_STARTED: 'visiobook.project.workflow.started',
  WORKFLOW_STEP_COMPLETED: 'visiobook.project.workflow.step_completed',
  WORKFLOW_COMPLETED: 'visiobook.project.workflow.completed',
  WORKFLOW_FAILED: 'visiobook.project.workflow.failed',
  WORKFLOW_CANCELLED: 'visiobook.project.workflow.cancelled',

  // Project lifecycle events
  PROJECT_DELETED: 'visiobook.project.deleted',

  // Media generation dispatch
  GENERATE_REFERENCES: 'visiobook.media.generate_references',
  IMAGE_GENERATION_STEP: 'visiobook.workflow.step.image_generation',
} as const;

// --- Inbound subjects (consumed from AI services) ---
export const AI_SUBJECTS = {
  ANALYSIS_COMPLETED: 'visiobook.ai.analysis.completed',
  ANALYSIS_FAILED: 'visiobook.ai.analysis.failed',
  REFERENCE_COMPLETED: 'visiobook.ai.reference.completed',
  REFERENCE_FAILED: 'visiobook.ai.reference.failed',
  MEDIA_IMAGE_COMPLETED: 'visiobook.ai.media.image.completed',
  MEDIA_AUDIO_COMPLETED: 'visiobook.ai.media.audio.completed',
  ASSEMBLY_COMPLETED: 'visiobook.ai.assembly.completed',
  ASSEMBLY_FAILED: 'visiobook.ai.assembly.failed',
  PROGRESS: 'visiobook.ai.progress',
} as const;

// --- Stream configuration ---
export const STREAM_NAME = 'VISIOBOOK_PROJECT';
export const STREAM_SUBJECTS = ['visiobook.project.>', 'visiobook.ai.>'];
export const CONSUMER_NAME = 'core-project-service';
export const CONSUMER_FILTER = 'visiobook.ai.>';

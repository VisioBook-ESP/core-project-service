export const WORKFLOW_QUEUE_NAME = 'project-workflow';

export enum WorkflowJobName {
  ANALYSIS = 'workflow:analysis',
  REFERENCE_GENERATION = 'workflow:reference-generation',
  IMAGE_GENERATION = 'workflow:image-generation',
  AUDIO_GENERATION = 'workflow:audio-generation',
  ASSEMBLY = 'workflow:assembly',
}

export interface WorkflowJobData {
  projectId: string;
  versionId: string;
  executionId: string;
  step: string;
  correlationId: string;
  userId: string;
}

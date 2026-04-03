export interface StepProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100 within the step
}

const STEP_WEIGHTS: Record<string, number> = {
  analysis: 15,
  scene_extraction: 0,
  character_extraction: 0,
  reference_generation: 10,
  image_generation: 35,
  audio_generation: 18,
  assembly: 22,
};

export function calculateProgress(steps: StepProgress[]): number {
  let totalProgress = 0;

  for (const step of steps) {
    const weight = STEP_WEIGHTS[step.step] ?? 0;
    if (weight === 0) continue;

    switch (step.status) {
      case 'completed':
        totalProgress += weight;
        break;
      case 'running':
        totalProgress += (weight * step.progress) / 100;
        break;
      case 'skipped':
        totalProgress += weight;
        break;
      case 'failed':
      case 'pending':
        break;
    }
  }

  return Math.min(100, Math.max(0, Math.round(totalProgress)));
}

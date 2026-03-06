import { calculateProgress } from '../../../src/workflow/workflow.progress.js';
import type { StepProgress } from '../../../src/workflow/workflow.progress.js';

describe('calculateProgress', () => {
  const ALL_STEPS: StepProgress[] = [
    { step: 'analysis', status: 'pending', progress: 0 },
    { step: 'scene_extraction', status: 'pending', progress: 0 },
    { step: 'character_extraction', status: 'pending', progress: 0 },
    { step: 'image_generation', status: 'pending', progress: 0 },
    { step: 'audio_generation', status: 'pending', progress: 0 },
    { step: 'assembly', status: 'pending', progress: 0 },
  ];

  it('should return 0 when all steps are pending', () => {
    expect(calculateProgress(ALL_STEPS)).toBe(0);
  });

  it('should return 100 when all steps are completed', () => {
    const steps = ALL_STEPS.map((s) => ({ ...s, status: 'completed' as const, progress: 100 }));
    expect(calculateProgress(steps)).toBe(100);
  });

  it('should calculate partial progress for a running step', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'running', progress: 50 },
      { step: 'scene_extraction', status: 'pending', progress: 0 },
      { step: 'character_extraction', status: 'pending', progress: 0 },
      { step: 'image_generation', status: 'pending', progress: 0 },
      { step: 'audio_generation', status: 'pending', progress: 0 },
      { step: 'assembly', status: 'pending', progress: 0 },
    ];
    // analysis weight = 15, 50% of 15 = 7.5 => rounded to 8
    expect(calculateProgress(steps)).toBe(8);
  });

  it('should ignore zero-weight steps', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'completed', progress: 100 },
      { step: 'scene_extraction', status: 'completed', progress: 100 },
      { step: 'character_extraction', status: 'completed', progress: 100 },
      { step: 'image_generation', status: 'pending', progress: 0 },
      { step: 'audio_generation', status: 'pending', progress: 0 },
      { step: 'assembly', status: 'pending', progress: 0 },
    ];
    // analysis(15) completed, scene_extraction(0), character_extraction(0) => 15
    expect(calculateProgress(steps)).toBe(15);
  });

  it('should treat skipped steps as completed weight', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'skipped', progress: 0 },
      { step: 'scene_extraction', status: 'skipped', progress: 0 },
      { step: 'character_extraction', status: 'skipped', progress: 0 },
      { step: 'image_generation', status: 'skipped', progress: 0 },
      { step: 'audio_generation', status: 'skipped', progress: 0 },
      { step: 'assembly', status: 'skipped', progress: 0 },
    ];
    expect(calculateProgress(steps)).toBe(100);
  });

  it('should handle mixed completed and running steps', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'completed', progress: 100 },
      { step: 'scene_extraction', status: 'completed', progress: 100 },
      { step: 'character_extraction', status: 'completed', progress: 100 },
      { step: 'image_generation', status: 'running', progress: 50 },
      { step: 'audio_generation', status: 'pending', progress: 0 },
      { step: 'assembly', status: 'pending', progress: 0 },
    ];
    // analysis(15) + image_gen(40*0.5=20) = 35
    expect(calculateProgress(steps)).toBe(35);
  });

  it('should not exceed 100', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'completed', progress: 100 },
      { step: 'image_generation', status: 'completed', progress: 100 },
      { step: 'audio_generation', status: 'completed', progress: 100 },
      { step: 'assembly', status: 'completed', progress: 100 },
    ];
    expect(calculateProgress(steps)).toBe(100);
  });

  it('should return 0 for empty steps array', () => {
    expect(calculateProgress([])).toBe(0);
  });

  it('should handle failed steps as 0 progress', () => {
    const steps: StepProgress[] = [
      { step: 'analysis', status: 'completed', progress: 100 },
      { step: 'image_generation', status: 'failed', progress: 50 },
      { step: 'audio_generation', status: 'pending', progress: 0 },
      { step: 'assembly', status: 'pending', progress: 0 },
    ];
    // analysis(15) + image_gen failed(0) = 15
    expect(calculateProgress(steps)).toBe(15);
  });
});

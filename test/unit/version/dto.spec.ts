import { CreateVersionSchema } from '../../../src/version/dto/create-version.dto.js';
import { VersionResponseSchema } from '../../../src/version/dto/version-response.dto.js';

describe('CreateVersionSchema', () => {
  it('should accept empty object (config is optional)', () => {
    const result = CreateVersionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid config', () => {
    const result = CreateVersionSchema.safeParse({ config: { style: 'cartoon' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({ style: 'cartoon' });
    }
  });

  it('should accept config with nested values', () => {
    const result = CreateVersionSchema.safeParse({
      config: { audio: { voice: 'en-US', speed: 1.0 } },
    });
    expect(result.success).toBe(true);
  });
});

describe('VersionResponseSchema', () => {
  const validResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '550e8400-e29b-41d4-a716-446655440001',
    versionNumber: 1,
    config: {},
    status: 'draft' as const,
    videoUrl: null,
    createdAt: '2025-01-01T00:00:00Z',
  };

  it('should accept valid response', () => {
    const result = VersionResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should coerce createdAt string to Date', () => {
    const result = VersionResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });

  it('should accept all valid status values', () => {
    const statuses = [
      'draft', 'analyzing', 'analyzed', 'configuring',
      'generating', 'completed', 'failed', 'cancelled',
    ];
    for (const status of statuses) {
      const result = VersionResponseSchema.safeParse({ ...validResponse, status });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = VersionResponseSchema.safeParse({ ...validResponse, status: 'running' });
    expect(result.success).toBe(false);
  });

  it('should accept non-null videoUrl', () => {
    const result = VersionResponseSchema.safeParse({
      ...validResponse,
      videoUrl: 'https://storage.example.com/video.mp4',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.videoUrl).toBe('https://storage.example.com/video.mp4');
    }
  });

  it('should accept optional executions array', () => {
    const result = VersionResponseSchema.safeParse({
      ...validResponse,
      executions: [{ id: 'exec-1' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executions).toEqual([{ id: 'exec-1' }]);
    }
  });

  it('should default executions to undefined when not provided', () => {
    const result = VersionResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executions).toBeUndefined();
    }
  });

  it('should reject invalid UUID for id', () => {
    const result = VersionResponseSchema.safeParse({ ...validResponse, id: 'not-uuid' });
    expect(result.success).toBe(false);
  });
});

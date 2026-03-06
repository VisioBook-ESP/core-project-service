import { UpdateContentSchema } from '../../../src/content/dto/update-content.dto.js';
import { ContentResponseSchema } from '../../../src/content/dto/content-response.dto.js';
import { SceneResponseSchema } from '../../../src/content/dto/scene-response.dto.js';

describe('UpdateContentSchema', () => {
  it('should accept valid text update', () => {
    const result = UpdateContentSchema.safeParse({ text: 'New content text' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('New content text');
    }
  });

  it('should accept valid metadata update', () => {
    const result = UpdateContentSchema.safeParse({ metadata: { source: 'ocr' } });
    expect(result.success).toBe(true);
  });

  it('should accept empty object (all fields optional)', () => {
    const result = UpdateContentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject empty text string', () => {
    const result = UpdateContentSchema.safeParse({ text: '' });
    expect(result.success).toBe(false);
  });

  it('should accept both text and metadata together', () => {
    const result = UpdateContentSchema.safeParse({
      text: 'Updated text',
      metadata: { lang: 'fr' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('Updated text');
      expect(result.data.metadata).toEqual({ lang: 'fr' });
    }
  });
});

describe('ContentResponseSchema', () => {
  const validResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '550e8400-e29b-41d4-a716-446655440001',
    text: 'Some extracted text',
    wordCount: 3,
    summary: null,
    metadata: {},
  };

  it('should accept valid response', () => {
    const result = ContentResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should accept non-null summary', () => {
    const result = ContentResponseSchema.safeParse({
      ...validResponse,
      summary: 'A brief summary',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe('A brief summary');
    }
  });

  it('should reject invalid UUID for id', () => {
    const result = ContentResponseSchema.safeParse({ ...validResponse, id: 'bad' });
    expect(result.success).toBe(false);
  });

  it('should reject missing text', () => {
    const { text: _, ...noText } = validResponse;
    const result = ContentResponseSchema.safeParse(noText);
    expect(result.success).toBe(false);
  });

  it('should reject non-number wordCount', () => {
    const result = ContentResponseSchema.safeParse({ ...validResponse, wordCount: 'many' });
    expect(result.success).toBe(false);
  });
});

describe('SceneResponseSchema', () => {
  const validScene = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    projectId: '550e8400-e29b-41d4-a716-446655440001',
    order: 1,
    text: 'Scene text',
    description: 'Scene description',
    imagePrompt: 'A beautiful landscape',
    generatedImageUrl: null,
    duration: 5.0,
    sentiment: null,
  };

  it('should accept valid scene response', () => {
    const result = SceneResponseSchema.safeParse(validScene);
    expect(result.success).toBe(true);
  });

  it('should accept non-null generatedImageUrl', () => {
    const result = SceneResponseSchema.safeParse({
      ...validScene,
      generatedImageUrl: 'https://storage.example.com/img.png',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedImageUrl).toBe('https://storage.example.com/img.png');
    }
  });

  it('should accept non-null sentiment', () => {
    const result = SceneResponseSchema.safeParse({
      ...validScene,
      sentiment: 'positive',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sentiment).toBe('positive');
    }
  });

  it('should reject missing required fields', () => {
    const { description: _, ...noDesc } = validScene;
    const result = SceneResponseSchema.safeParse(noDesc);
    expect(result.success).toBe(false);
  });

  it('should reject non-number order', () => {
    const result = SceneResponseSchema.safeParse({ ...validScene, order: 'first' });
    expect(result.success).toBe(false);
  });

  it('should reject non-number duration', () => {
    const result = SceneResponseSchema.safeParse({ ...validScene, duration: 'long' });
    expect(result.success).toBe(false);
  });
});

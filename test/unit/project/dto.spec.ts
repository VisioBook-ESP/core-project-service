import { CreateProjectSchema } from '../../../src/project/dto/create-project.dto.js';
import { UpdateProjectSchema } from '../../../src/project/dto/update-project.dto.js';
import { ProjectResponseSchema } from '../../../src/project/dto/project-response.dto.js';
import { ListProjectsQuerySchema } from '../../../src/project/dto/list-projects-query.dto.js';

describe('CreateProjectSchema', () => {
  const validInput = {
    title: 'My Project',
    sourceType: 'file' as const,
    content: { text: 'Hello world' },
  };

  it('should accept valid input', () => {
    const result = CreateProjectSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Project');
      expect(result.data.sourceType).toBe('file');
      expect(result.data.content.text).toBe('Hello world');
    }
  });

  it('should apply default config to empty object', () => {
    const result = CreateProjectSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({});
    }
  });

  it('should apply default metadata on content', () => {
    const result = CreateProjectSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content.metadata).toEqual({});
    }
  });

  it('should reject empty title', () => {
    const result = CreateProjectSchema.safeParse({ ...validInput, title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 200 characters', () => {
    const result = CreateProjectSchema.safeParse({ ...validInput, title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sourceType', () => {
    const result = CreateProjectSchema.safeParse({ ...validInput, sourceType: 'video' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid sourceType values', () => {
    for (const sourceType of ['file', 'scan', 'text']) {
      const result = CreateProjectSchema.safeParse({ ...validInput, sourceType });
      expect(result.success).toBe(true);
    }
  });

  it('should reject missing content', () => {
    const { content: _, ...noContent } = validInput;
    const result = CreateProjectSchema.safeParse(noContent);
    expect(result.success).toBe(false);
  });

  it('should reject empty content text', () => {
    const result = CreateProjectSchema.safeParse({
      ...validInput,
      content: { text: '' },
    });
    expect(result.success).toBe(false);
  });

  it('should accept custom config', () => {
    const result = CreateProjectSchema.safeParse({
      ...validInput,
      config: { style: 'cartoon', duration: 60 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({ style: 'cartoon', duration: 60 });
    }
  });
});

describe('UpdateProjectSchema', () => {
  it('should accept valid title update', () => {
    const result = UpdateProjectSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('New Title');
    }
  });

  it('should accept valid config update', () => {
    const result = UpdateProjectSchema.safeParse({ config: { key: 'value' } });
    expect(result.success).toBe(true);
  });

  it('should accept empty object (no fields required)', () => {
    const result = UpdateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject empty title string', () => {
    const result = UpdateProjectSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 200 characters', () => {
    const result = UpdateProjectSchema.safeParse({ title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe('ProjectResponseSchema', () => {
  const validResponse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    title: 'My Project',
    status: 'draft' as const,
    sourceType: 'file' as const,
    config: {},
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('should accept valid response data', () => {
    const result = ProjectResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should coerce date strings to Date objects', () => {
    const result = ProjectResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('should accept all valid status values', () => {
    for (const status of ['draft', 'active', 'archived']) {
      const result = ProjectResponseSchema.safeParse({ ...validResponse, status });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid UUID for id', () => {
    const result = ProjectResponseSchema.safeParse({ ...validResponse, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = ProjectResponseSchema.safeParse({ ...validResponse, status: 'deleted' });
    expect(result.success).toBe(false);
  });
});

describe('ListProjectsQuerySchema', () => {
  it('should apply all defaults with empty object', () => {
    const result = ListProjectsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.sortBy).toBe('updatedAt');
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('should coerce string numbers', () => {
    const result = ListProjectsQuerySchema.safeParse({ page: '3', pageSize: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('should reject page less than 1', () => {
    const result = ListProjectsQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject pageSize greater than 100', () => {
    const result = ListProjectsQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sortBy', () => {
    const result = ListProjectsQuerySchema.safeParse({ sortBy: 'title' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sortOrder', () => {
    const result = ListProjectsQuerySchema.safeParse({ sortOrder: 'random' });
    expect(result.success).toBe(false);
  });

  it('should accept valid sortBy and sortOrder', () => {
    const result = ListProjectsQuerySchema.safeParse({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortBy).toBe('createdAt');
      expect(result.data.sortOrder).toBe('asc');
    }
  });
});

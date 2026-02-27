import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe.js';

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
});

class TestDto extends createZodDto(TestSchema) {}

describe('ZodValidationPipe', () => {
  let pipe: InstanceType<typeof ZodValidationPipe>;

  beforeEach(() => {
    pipe = new ZodValidationPipe();
  });

  it('should pass through valid input', () => {
    const input = { name: 'test', age: 25 };
    const metadata = { type: 'body' as const, metatype: TestDto };

    const result = pipe.transform(input, metadata);

    expect(result).toEqual({ name: 'test', age: 25 });
  });

  it('should throw BadRequestException for invalid input', () => {
    const input = { name: 123 };
    const metadata = { type: 'body' as const, metatype: TestDto };

    expect(() => pipe.transform(input, metadata)).toThrow(BadRequestException);
  });

  it('should include field-level errors in BadRequestException', () => {
    const input = { name: 123 };
    const metadata = { type: 'body' as const, metatype: TestDto };

    try {
      pipe.transform(input, metadata);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Validation failed');
      expect(response.errors).toBeDefined();
      expect(Array.isArray(response.errors)).toBe(true);
    }
  });

  it('should strip extra fields', () => {
    const input = { name: 'test', age: 25, extra: true };
    const metadata = { type: 'body' as const, metatype: TestDto };

    const result = pipe.transform(input, metadata);

    expect(result).toEqual({ name: 'test', age: 25 });
    expect(result).not.toHaveProperty('extra');
  });

  it('should pass through values without a ZodDto metatype', () => {
    const input = { anything: 'goes' };
    const metadata = { type: 'body' as const, metatype: undefined };

    const result = pipe.transform(input, metadata);

    expect(result).toEqual({ anything: 'goes' });
  });
});

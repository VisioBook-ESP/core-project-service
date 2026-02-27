import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';

export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error) =>
    new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    }),
});

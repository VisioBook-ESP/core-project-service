import { sanitizeText } from '../../../src/common/utils/sanitize.js';

describe('sanitizeText', () => {
  it('should strip <script> tags including content', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    expect(sanitizeText(input)).toBe('Hello  World');
  });

  it('should strip <iframe> tags', () => {
    const input = 'Before <iframe src="https://evil.com"></iframe> After';
    expect(sanitizeText(input)).toBe('Before  After');
  });

  it('should strip event handlers (onclick, onerror)', () => {
    const input = '<div onclick="alert(1)">Click</div>';
    expect(sanitizeText(input)).toBe('Click');
  });

  it('should preserve plain text', () => {
    const input = 'Just a normal text string';
    expect(sanitizeText(input)).toBe('Just a normal text string');
  });

  it('should handle nested tags', () => {
    const input = '<div><span><b>Bold</b></span></div>';
    expect(sanitizeText(input)).toBe('Bold');
  });

  it('should handle empty string input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('should trim whitespace', () => {
    const input = '  hello world  ';
    expect(sanitizeText(input)).toBe('hello world');
  });
});

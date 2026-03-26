import sanitize from 'sanitize-html';

const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

export function sanitizeText(input: string): string {
  return sanitize(input, SANITIZE_OPTIONS).trim();
}

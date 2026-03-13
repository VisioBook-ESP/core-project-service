/**
 * Auth helpers for E2E tests.
 */

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
export const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';

export function authHeaders(userId: string = TEST_USER_ID): Record<string, string> {
  return { 'X-User-Id': userId };
}

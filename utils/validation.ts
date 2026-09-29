import { USERNAME_MAX_LENGTH, USERNAME_REGEX } from './constants';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Structural check on an already-normalized (lowercase) username. Never contacts Instagram. */
export function isValidUsername(username: string): ValidationResult {
  if (!username) return { valid: false, reason: 'empty' };
  if (username.length > USERNAME_MAX_LENGTH) return { valid: false, reason: 'too_long' };
  if (!USERNAME_REGEX.test(username)) return { valid: false, reason: 'invalid_characters' };
  if (username.startsWith('.') || username.endsWith('.')) return { valid: false, reason: 'invalid_dot_position' };
  if (username.includes('..')) return { valid: false, reason: 'consecutive_dots' };
  return { valid: true };
}

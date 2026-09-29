import { DatabaseError } from '../database/database';

/** An error that carries a friendly message safe to show to users. */
export class AppError extends Error {
  constructor(message: string, public readonly userMessage: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** Never returns raw technical text; screens should show this instead of error.message. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof DatabaseError) return 'Something went wrong while accessing your data. Please try again.';
  return 'Something went wrong. Please try again.';
}

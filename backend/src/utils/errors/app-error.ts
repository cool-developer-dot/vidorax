export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

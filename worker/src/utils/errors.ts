export interface UpstreamErrorContext {
  service: string;
  operation: string;
  url?: string;
  status?: number;
  detail?: string;
}

export class UpstreamServiceError extends Error {
  readonly context: UpstreamErrorContext;

  constructor(message: string, context: UpstreamErrorContext, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UpstreamServiceError";
    this.context = context;
  }
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof UpstreamServiceError) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: serializeCause(error.cause),
      ...error.context,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: serializeCause(error.cause),
    };
  }

  return {
    name: "NonErrorThrow",
    message: String(error),
  };
}

function serializeCause(cause: unknown): Record<string, unknown> | undefined {
  if (!cause) return undefined;
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }
  return { message: String(cause) };
}

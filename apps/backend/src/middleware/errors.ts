import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { ZodError } from "zod";
import type { Logger } from "../types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
};

function describeZodError(error: ZodError): string {
  return error.issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
    )
    .join("; ");
}

function readBodyParserError(error: unknown): { status: number; type: string } | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if (!("status" in error) || !("type" in error)) return undefined;
  const { status, type } = error;
  if (typeof status !== "number" || typeof type !== "string") return undefined;
  return { status, type };
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        error: { code: "validation_error", message: describeZodError(error) },
      });
      return;
    }

    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    const bodyError = readBodyParserError(error);
    if (bodyError && bodyError.status >= 400 && bodyError.status < 500) {
      if (bodyError.type === "entity.too.large") {
        res.status(413).json({
          error: { code: "payload_too_large", message: "Request body is too large" },
        });
        return;
      }
      if (bodyError.type === "entity.parse.failed") {
        res.status(400).json({
          error: { code: "invalid_json", message: "Request body is not valid JSON" },
        });
        return;
      }
      res.status(400).json({
        error: { code: "invalid_request", message: "The request could not be processed" },
      });
      return;
    }

    logger.error(
      `Unhandled error: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    res.status(500).json({
      error: { code: "internal_error", message: "Internal server error" },
    });
  };
}
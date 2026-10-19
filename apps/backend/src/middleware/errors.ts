import type { ErrorRequestHandler, RequestHandler } from "express";

export const malformedJson: ErrorRequestHandler = (error, _request, response, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body contains malformed JSON" } });
    return;
  }
  next(error);
};

export const errorHandler = (error: unknown, _request: Parameters<ErrorRequestHandler>[1], response: Parameters<ErrorRequestHandler>[2], _next: Parameters<ErrorRequestHandler>[3]): void => {
  void _next;
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) process.stderr.write("Unhandled request error\n");
  response.status(status).json({ error: { code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR", message: status === 500 ? "An unexpected error occurred" : "Request could not be processed" } });
};

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
};

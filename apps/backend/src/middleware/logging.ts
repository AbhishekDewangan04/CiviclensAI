import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, response, next) => {
  const started = Date.now();
  response.on("finish", () => {
    process.stdout.write(JSON.stringify({ method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - started }) + "\n");
  });
  next();
};

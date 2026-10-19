import { Router } from "express";

export function healthRoutes(isReady: () => boolean): Router {
  const router = Router();
  router.get("/health", (_request, response) => response.status(200).json({ success: true, service: "civiclens-backend", status: "healthy" }));
  router.get("/ready", (_request, response) => {
    const ready = isReady();
    return response.status(ready ? 200 : 503).json({
      success: ready,
      service: "civiclens-backend",
      status: ready ? "ready" : "not_ready",
      dependencies: { database: "not_configured", ml: "not_configured" },
    });
  });
  return router;
}

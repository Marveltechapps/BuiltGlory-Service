import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { corsOriginOption } from "./config/cors.js";
import { getRedis } from "./config/redis.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { mongoSanitize } from "./middleware/mongoSanitize.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./modules/error/index.js";
import routes from "./routes/index.js";
import signinRoutes from "./modules/signin/signin.routes.js";
import { openapi } from "./docs/openapi.js";
import { metricsSnapshot } from "./services/metrics.service.js";
const sendLiveness = (req, res) => {
  res.status(200).json({ status: "ok", uptimeSeconds: process.uptime() });
};

export const createApp = () => {
  const app = express();
  // One hop (Nginx / load balancer). Without this, every client shares the proxy IP bucket.
  app.set("trust proxy", 1);
  // Liveness is registered before rate limiting and body parsers. A Redis or Mongo
  // outage must not turn the process probe into HTTP 500. Dependency health is GET /ready.
  app.get("/health", sendLiveness);
  app.get("/", sendLiveness);
  app.use(requestContext);
  app.use(requestLogger);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: corsOriginOption(env.CORS_ORIGINS, env.NODE_ENV), credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(mongoSanitize);
  app.use(generalLimiter);
  // QA-BUG-009: readiness must fail when MongoDB or Redis is unreachable.
  app.get("/ready", async (req, res) => {
    const checks = { api: "ok", memory: "ok", mongodb: "unknown", redis: "unknown" };
    let ready = true;
    try {
      checks.mongodb = mongoose.connection.readyState === 1 ? "ok" : "unavailable";
      if (checks.mongodb !== "ok") ready = false;
    } catch {
      checks.mongodb = "error";
      ready = false;
    }
    try {
      const redis = getRedis();
      if (typeof redis.ping === "function") {
        const pong = await redis.ping();
        checks.redis = pong === "PONG" || pong === "pong" ? "ok" : "unavailable";
      } else if (env.REDIS_URL) {
        checks.redis = "unavailable";
        ready = false;
      } else {
        // In-memory stub used for local/test when REDIS_URL is unset.
        checks.redis = "ok";
      }
      if (checks.redis !== "ok") ready = false;
    } catch {
      checks.redis = "error";
      ready = false;
    }
    if (!ready) return res.status(503).json({ status: "not_ready", checks });
    return res.json({ status: "ready", checks });
  });
  app.get("/metrics", (req, res) => {
    const address = req.socket?.remoteAddress || "";
    const loopback = address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
    if (!loopback) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
    return res.json(metricsSnapshot());
  });
  if (env.NODE_ENV === "production") {
    const hidden = (req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
    app.get("/openapi.json", hidden);
    app.use("/api-docs", hidden);
  } else {
    app.get("/openapi.json", (req, res) => res.json(openapi));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
  }
  app.use("/api/signin", signinRoutes);
  app.use("/api/v1", routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
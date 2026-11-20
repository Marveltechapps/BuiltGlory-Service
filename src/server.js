import http from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { assertTransactionsAvailableInProduction } from "./database/transactions.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { closeRedis, connectRedis, isRedisDependencyError } from "./config/redis.js";
import { closeChatSocket, initChatSocket } from "./realtime/chatSocket.js";
import { listenWithPortFallback } from "./utils/findAvailablePort.js";
import { scheduleJobs, stopScheduledJobs } from "./jobs/index.js";

const PREFERRED_PORT = Number(process.env.PORT) || 5001;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server;
let activePort;
let isShuttingDown = false;

function closeHttpServer(httpServer) {
  return new Promise((resolve, reject) => {
    if (!httpServer.listening) {
      resolve();
      return;
    }

    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });

    // Drop keep-alive / idle sockets so the port is released promptly (Node >= 18.2).
    if (typeof httpServer.closeAllConnections === "function") {
      httpServer.closeAllConnections();
    }
  });
}

async function shutdown(signal, { exitProcess = true, exitCode = 0 } = {}) {
  if (isShuttingDown) {
    if (exitCode !== 0) process.exit(exitCode);
    return;
  }
  isShuttingDown = true;

  logger.info({ message: "Graceful shutdown started", signal, port: activePort });

  const forceExit = setTimeout(() => {
    logger.error({ message: "Graceful shutdown timed out; forcing exit" });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref?.();

  try {
    stopScheduledJobs();
    await closeChatSocket();
    if (server) await closeHttpServer(server);
    await disconnectDatabase();
    await closeRedis();
    clearTimeout(forceExit);
    logger.info({ message: "Graceful shutdown complete", signal });
    if (exitProcess) process.exit(exitCode);
  } catch (error) {
    clearTimeout(forceExit);
    logger.error({
      message: "Graceful shutdown failed",
      error: error.message,
      stack: error.stack
    });
    if (exitProcess) process.exit(exitCode === 0 ? 1 : exitCode);
    throw error;
  }
}

function registerSignalHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  // Nodemon may send SIGUSR2 on restart (Unix). Clean up, then re-raise so nodemon can respawn.
  try {
    process.once("SIGUSR2", () => {
      void shutdown("SIGUSR2", { exitProcess: false })
        .then(() => {
          process.kill(process.pid, "SIGUSR2");
        })
        .catch(() => {
          process.exit(1);
        });
    });
  } catch {
    // Signal unsupported on this platform.
  }

  // Exit non-zero so systemd Restart=on-failure replaces the process after a crash.
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (isRedisDependencyError(error)) {
      logger.error({
        message: "Redis command failed without a waiting handler. The API process will keep running and critical Redis work stays failed closed.",
        error: error.message
      });
      return;
    }
    logger.error({ message: "Unhandled rejection", error: error.message, stack: error.stack });
    void shutdown("unhandledRejection", { exitCode: 1 });
  });

  process.on("uncaughtException", (error) => {
    logger.error({ message: "Uncaught exception", error: error.message, stack: error.stack });
    void shutdown("uncaughtException", { exitCode: 1 });
  });
}

async function bootstrap() {
  registerSignalHandlers();

  await connectDatabase();
  await connectRedis();
  await assertTransactionsAvailableInProduction();
  const app = createApp();
  server = http.createServer(app);
  initChatSocket(server);

  const bound = await listenWithPortFallback(server, PREFERRED_PORT, {
    allowFallback: env.NODE_ENV !== "production" && env.NODE_ENV !== "staging"
  });
  activePort = bound.port;

  if (bound.fellBack) {
    logger.warn({
      message: "Preferred port busy; using next available port",
      preferredPort: bound.preferredPort,
      selectedPort: bound.port
    });
  }

  const startupMessage = `BuiltGlory API running on port ${activePort}`;
  console.log(startupMessage);
  logger.info({ message: startupMessage, port: activePort, preferredPort: PREFERRED_PORT });
  logger.info({ message: "BuiltGlory realtime chat listening", port: activePort });
  logger.info({
    message: "SMS delivery configuration",
    mode: env.SMS_DELIVERY_MODE,
    vendorConfigured: Boolean(String(env.SMS_VENDOR_URL || env.SMS_PROVIDER_URL || "").trim())
  });
  if (env.NODE_ENV !== "test") {
    scheduleJobs();
    import("./modules/geo/geo.coordinates.js")
      .then((mod) => mod.backfillMissingPropertyCoordinates())
      .catch((error) => logger.error({ message: "Property map backfill failed", error: error.message }));
  }
  if (env.SMS_DELIVERY_MODE === "vendor") {
    logger.warn({
      message:
        "Phone OTP uses SMS_DELIVERY_MODE=vendor (Spear UC). OTP send will fail if the reseller account has no SMS credits."
    });
  }
  if (env.SMS_DELIVERY_MODE === "log") {
    logger.warn({
      message: "Phone OTP uses SMS_DELIVERY_MODE=log. No real SMS is sent."
    });
  }
}

bootstrap().catch((error) => {
  console.error(`[BuiltGlory API] Failed to start: ${error.message}`);
  logger.error({
    message: "BuiltGlory API failed to start",
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

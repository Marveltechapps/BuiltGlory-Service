import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const redactMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = "redacted";
    if (parsed.password) parsed.password = "redacted";
    return parsed.toString();
  } catch {
    return "<invalid MongoDB URI>";
  }
};

const getTopologyDiagnostics = (error) => {
  const topology = error?.reason || error?.cause;
  if (!topology?.servers) return undefined;

  return {
    type: topology.type,
    setName: topology.setName,
    compatible: topology.compatible,
    servers: [...topology.servers.entries()].map(([address, server]) => ({
      address,
      type: server.type,
      errorName: server.error?.name,
      errorCode: server.error?.code || server.error?.cause?.code,
      errorMessage: server.error?.message,
      beforeHandshake: server.error?.beforeHandshake,
      tlsReason: server.error?.cause?.reason,
      tlsCode: server.error?.cause?.code
    }))
  };
};

const logMongoConnectionError = (error) => {
  logger.error({
    message: "MongoDB connection failed",
    name: error.name,
    code: error.code,
    reason: error.reason?.type,
    errorMessage: error.message,
    uri: redactMongoUri(env.MONGODB_URI),
    topology: getTopologyDiagnostics(error),
    stack: error.stack
  });
};

const configureMongoDnsServers = () => {
  if (!env.MONGODB_URI.startsWith("mongodb+srv://") || !env.MONGODB_DNS_SERVERS) return;

  const servers = env.MONGODB_DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean);
  if (!servers.length) return;

  dns.setServers(servers);
  logger.info({ message: "Configured MongoDB DNS servers", servers });
};

let hasConnected = false;
let isInitialConnection = false;
let listenersInstalled = false;
let suppressConnectionErrorsUntil = 0;

export const connectDatabase = async () => {
  mongoose.set("strictQuery", true);
  configureMongoDnsServers();

  if (!listenersInstalled) {
    mongoose.connection.on("connected", () => {
      hasConnected = true;
      logger.info({ message: "MongoDB connected" });
    });
    mongoose.connection.on("disconnected", () => {
      if (hasConnected) logger.warn({ message: "MongoDB disconnected" });
    });
    mongoose.connection.on("error", (error) => {
      if (Date.now() < suppressConnectionErrorsUntil) return;
      if (!isInitialConnection) logMongoConnectionError(error);
    });
    listenersInstalled = true;
  }

  try {
    isInitialConnection = true;
    // Never build indexes at app startup in production — use `npm run migrate` (G-39 / §13.2).
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      autoIndex: env.NODE_ENV !== "production",
      tls: env.MONGODB_URI.startsWith("mongodb+srv://")
    });
  } catch (error) {
    logMongoConnectionError(error);
    suppressConnectionErrorsUntil = Date.now() + 2000;
    const code = error?.code || error?.cause?.code || error?.name || "UNKNOWN";
    const text = `${error?.message || ""} ${error?.cause?.message || ""}`;
    let hint = "Check MONGODB_URI and that this machine can reach the database.";
    if (/ECONNREFUSED/i.test(text)) {
      hint = "Nothing is accepting MongoDB connections at that address. Start MongoDB or correct MONGODB_URI.";
    } else if (/ENOTFOUND|querySrv|EAI_AGAIN|ETIMEOUT/i.test(text)) {
      hint = "DNS lookup failed. Check the hostname, this machine's network, and MONGODB_DNS_SERVERS.";
    } else if (/authentication failed|bad auth|AtlasError/i.test(text)) {
      hint = "Authentication failed. Check the username and password in MONGODB_URI.";
    }
    const wrapped = new Error(`MongoDB connection failed (${code}): ${error.message}. ${hint} Target: ${redactMongoUri(env.MONGODB_URI)}`);
    wrapped.cause = error;
    throw wrapped;
  } finally {
    isInitialConnection = false;
  }
};
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
};
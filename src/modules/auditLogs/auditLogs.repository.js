import { AuditLog } from "./auditLogs.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(AuditLog);
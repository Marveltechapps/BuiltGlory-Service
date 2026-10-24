import { createController } from "../../utils/controller.factory.js";
import { service } from "./auditLogs.service.js";
export const controller = createController(service);
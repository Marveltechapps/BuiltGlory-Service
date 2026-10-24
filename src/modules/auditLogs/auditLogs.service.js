import { createService } from "../../services/service.factory.js";
import { repository } from "./auditLogs.repository.js";
export const service = createService({ collection: "auditLogs", repository, workflowField: null, workflowMap: null, ownerField: null });
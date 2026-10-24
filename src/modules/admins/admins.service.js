import { createService } from "../../services/service.factory.js";
import { repository } from "./admins.repository.js";
export const service = createService({ collection: "admins", repository, workflowField: null, workflowMap: null, ownerField: null });
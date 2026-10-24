import { createController } from "../../utils/controller.factory.js";
import { service } from "./sellRequests.service.js";
export const controller = createController(service);
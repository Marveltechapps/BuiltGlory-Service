import { createController } from "../../utils/controller.factory.js";
import { service } from "./documents.service.js";
export const controller = createController(service);
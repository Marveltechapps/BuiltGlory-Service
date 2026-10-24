import { createController } from "../../utils/controller.factory.js";
import { service } from "./notifications.service.js";
export const controller = createController(service);
import { createController } from "../../utils/controller.factory.js";
import { service } from "./callbacks.service.js";
export const controller = createController(service);
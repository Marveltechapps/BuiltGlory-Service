import { createController } from "../../utils/controller.factory.js";
import { service } from "./properties.service.js";
export const controller = createController(service);
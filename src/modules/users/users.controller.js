import { createController } from "../../utils/controller.factory.js";
import { service } from "./users.service.js";
export const controller = createController(service);
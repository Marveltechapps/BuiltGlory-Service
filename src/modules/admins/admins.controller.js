import { createController } from "../../utils/controller.factory.js";
import { service } from "./admins.service.js";
export const controller = createController(service);
import { createController } from "../../utils/controller.factory.js";
import { service } from "./payments.service.js";
export const controller = createController(service);
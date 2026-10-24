import { createController } from "../../utils/controller.factory.js";
import { service } from "./acquisitions.service.js";
export const controller = createController(service);
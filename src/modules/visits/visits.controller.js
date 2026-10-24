import { createController } from "../../utils/controller.factory.js";
import { service } from "./visits.service.js";
export const controller = createController(service);